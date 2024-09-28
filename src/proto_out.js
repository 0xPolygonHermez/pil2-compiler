const protobuf = require('protobufjs');
const {cloneDeep} = require('lodash');
const Long = require('long');
const fs = require('fs');
const util = require('util');
const assert = require('./assert.js');
const Context = require('./context.js');
const StringValue = require('./expression_items/string_value.js');

const MAX_CHALLENGE = 200;
const MAX_STAGE = 20;
const MAX_PERIODIC_COLS = 60;
const MAX_PERIODIC_ROWS = 256;
const MAX_ROWS = 2 ** 28;
const MAX_FIXED_COLS = 150;
const MAX_PUBLICS = 50;

const GLOBAL_EXPRESSIONS = 1000;
const GLOBAL_CONSTRAINTS = 100;

const REF_TYPE_IM_COL = 0;
const REF_TYPE_FIXED_COL = 1;
const REF_TYPE_PERIODIC_COL = 2;
const REF_TYPE_WITNESS_COL = 3;
const REF_TYPE_PROOF_VALUE = 4;
const REF_TYPE_AIR_GROUP_VALUE = 5;
const REF_TYPE_PUBLIC_VALUE = 6;
const REF_TYPE_PUBLIC_TABLE = 7;
const REF_TYPE_CHALLENGE = 8;

const SPV_AGGREGATIONS = ['sum', 'prod'];
module.exports = class ProtoOut {
    constructor (Fr, options = {}) {
        this.version = 1;
        this.avoidAirsWithSameName = true;
        this.Fr = Fr;
        this.root = protobuf.loadSync(__dirname + '/pilout.proto');
        this.constants = false;
        this.debug = false;
        this.symbols = true;
        this.varbytes = true;
        this.airs = [];
        this.currentAir = null;
        this.currentAirGroup = null;
        this.witnessId2ProtoId = [];
        this.fixedId2ProtoId = [];
        this.airGroupValueId2ProtoId = []; 
        this.options = options;
        this.bigIntType = options.bigIntType ?? 'Buffer';
        this.toBaseField = this.mapBigIntType();
        this.airStack = [];
        this.buildTypes();
    }
    mapBigIntType() {
        switch (this.bigIntType) {
            case 'Buffer': return this.bint2buf;
            case 'BigInt': return this.bint2bint;
            case 'uint8':
                this.uint8size = this.options.uint8size ?? 8;
                return this.bint2uint8;
        }
        throw new Error(`Invalid bigIntType ${this.bigIntType} on ProtoOut`);
    }
    buildTypes() {
        this.PilOut = this.root.lookupType('PilOut');
        this.AirGroup = this.root.lookupType('Subproof');
        this.BasicAir = this.root.lookupType('BasicAir');
        this.PublicTable = this.root.lookupType('PublicTable');
        this.GlobalExpression = this.root.lookupType('GlobalExpression');
        this.GlobalConstraint = this.root.lookupType('GlobalConstraint');
        this.Symbol = this.root.lookupType('Symbol');
        this.GlobalOperand = this.root.lookupType('GlobalOperand');
        this.GlobalExpression_Add = this.root.lookupType('GlobalExpression.Add');
        this.GlobalExpression_Sub = this.root.lookupType('GlobalExpression.Sub');
        this.GlobalExpression_Mul = this.root.lookupType('GlobalExpression.Mul');
        this.GlobalExpression_Neg = this.root.lookupType('GlobalExpression.Neg');
        this.GlobalOperand_Constant = this.root.lookupType('GlobalOperand.Constant');
        this.GlobalOperand_Challenge = this.root.lookupType('GlobalOperand.Challenge');
        this.GlobalOperand_AirGroupValue = this.root.lookupType('GlobalOperand.SubproofValue');
        this.GlobalOperand_ProofValue = this.root.lookupType('GlobalOperand.ProofValue');
        this.GlobalOperand_PublicValue = this.root.lookupType('GlobalOperand.PublicValue');
        this.GlobalOperand_PublicTableAggregateValue = this.root.lookupType('GlobalOperand.PublicTableAggregatedValue');
        this.GlobalOperand_PublicTableColumn = this.root.lookupType('GlobalOperand.PublicTableColumn');
        this.GlobalOperand_Expression = this.root.lookupType('GlobalOperand.Expression');
        this.PeriodicCol = this.root.lookupType('PeriodicCol');
        this.FixedCol = this.root.lookupType('FixedCol');
        this.Expression = this.root.lookupType('Expression');
        this.Constraint = this.root.lookupType('Constraint');
        this.Operand_Expression = this.root.lookupType('Operand.Expression');
        this.Constraint_FirstRow = this.root.lookupType('Constraint.FirstRow');
        this.Constraint_LastRow = this.root.lookupType('Constraint.LastRow');
        this.Constraint_EveryRow = this.root.lookupType('Constraint.EveryRow');
        this.Constraint_EveryFrame = this.root.lookupType('Constraint.EveryFrame');
        this.Operand_Constant = this.root.lookupType('Operand.Constant');
        this.Operand_Challenge = this.root.lookupType('Operand.Challenge');
        this.Operand_AirGropValue = this.root.lookupType('Operand.SubproofValue');
        this.Operand_ProofValue = this.root.lookupType('Operand.ProofValue');
        this.Operand_PublicValue = this.root.lookupType('Operand.PublicValue');
        this.Operand_PeriodicCol = this.root.lookupType('Operand.PeriodicCol');
        this.Operand_FixedCol = this.root.lookupType('Operand.FixedCol');
        this.Operand_WitnessCol = this.root.lookupType('Operand.WitnessCol');
        this.Expression_Add = this.root.lookupType('Expression.Add');
        this.Expression_Sub = this.root.lookupType('Expression.Sub');
        this.Expression_Mul = this.root.lookupType('Expression.Mul');
        this.Expression_Neg = this.root.lookupType('Expression.Neg');

        // FrontEndField not used

        this.HintField = this.root.lookupType('HintField');
        this.HintFieldArray = this.root.lookupType('HintFieldArray');
        this.Hint = this.root.lookupType('Hint');
    }
    setupPilOut(name) {
        console.log('FR', this.Fr.p, this.toBaseField(this.Fr.p));
        this.pilOut = {
            name,
            baseField: this.toBaseField(this.Fr.p, 0, false),
            blowupFactor: 3,
            subproofs: [],
            numChallenges: [],
            numProofValues: 0,
            numPublicValues: 0,
            publicTables: [],
            expressions: [],
            constraints: [],
            hints: [],
            symbols: []
        }
    }
    encode() {
        this.updateSymbolsWithSameName();

        // fs.writeFileSync('tmp/pilout.pre.log', util.inspect(this.pilOut, false, null, false));
        let message = this.PilOut.fromObject(this.pilOut);
        // fs.writeFileSync('tmp/pilout.log', util.inspect(this.pilOut, false, null, false));
        this.data = this.PilOut.encode(message).finish();
        return this.data;
    }
    saveToFile(filename) {
        fs.writeFileSync(filename, this.data);
    }
    pushAir(airId, name, rows, aggregable = true) {
        assert.equal(airId, this.currentAirGroup.airs.length);
        if (this.currentAir !== null) {
            this.airStack.push(this.currentAir);
        }
        this.currentAir = {name, numRows: Number(rows), airId};
        if (this.version >= 2) {
            this.currentAir.aggregable = aggregable;
        }
        if (this.avoidAirsWithSameName && this.currentAirGroup.airs.some(x => x.name === name)) {
            this.currentAir.name = `${this.currentAir.name}_${airId}`;
        }
        this.currentAirGroup.airs.push(this.currentAir);
    }
    popAir() {
        if (this.airStack.length) {
            this.currentAir = this.airStack.pop();
        } else {
            this.currentAir = null;
        }
    }
    useAirGroup(airGroupId) { // TODO: Add subproof value
        // check if exist a subproof with this name, if not create it.
        const airGroup = this.pilOut.subproofs.find(sp => sp.airGroupId === airGroupId);
        if (typeof airGroup === 'undefined') {
            throw new Error(`Using airGroupId ${airGroupId} not found on proto`);
        }
        this.currentAirGroup = airGroup;
    }
    setAirGroup(airGroupId, name) { // TODO: Add air group value
        // check if exist a air group with this name, if not create it.
        assert.equal(airGroupId, this.pilOut.subproofs.length);
        this.currentAirGroup = {name, airs: [], airGroupId };
        if (this.version < 2) {
            this.currentAirGroup.aggregable = true;
        }
        this.pilOut.subproofs.push(this.currentAirGroup);
    }
    setAirGroupValues(ids, aggregations) {
        assert.equal(ids.length, aggregations.length);
        this.currentAirGroup.subproofvalues = [];
        for (let index = 0; index < ids.length; ++index) {
            this.airGroupValueId2ProtoId[ids[index]] = index;
            const aggType = SPV_AGGREGATIONS.indexOf(aggregations[index]);
            if (aggType < 0) {
                throw new Error(`Invalid aggregation type on ${Context.sourceRef}`);
            }
            this.currentAirGroup.subproofvalues.push({aggType});
        }
    }
    setGlobalSymbols(symbols) {
        this._setSymbols(symbols.keyValuesOfTypes(['public', 'proofvalue', 'challenge', 'publictable']));
    }
    setSymbolsFromLabels(labels, type, data = {}) {
        let symbols = [];
        for (const label of labels) {
            symbols.push([label.label, {type, locator: label.from, array: label.multiarray, data: {}}]);
        }   
        this._setSymbols(symbols, data);
    }
    _setSymbols(symbols, data = {}) {
        for(const [name, ref] of symbols) {
            try {
                const arrayInfo = ref.array ? ref.array : {dim: 0, lengths: []};
                const sym2proto = this.symbolType2Proto(ref.type, ref.locator, {...ref, data});
                let payout = {
                    name,
                    dim: arrayInfo.dim,
                    lengths: arrayInfo.lengths,
                    debugLine: (ref.data ?? {}).sourceRef ?? '',
                    ...data,
                    ...sym2proto
                };
                if (this.version < 2) {
                    if (typeof payout.airGroupId !== 'undefined') {
                        if (typeof payout.subproofId !== 'undefined' && payout.airGroupId !== payout.subproofId) {
                            throw new Error(`airGroupId(${payout.airGroupId}) and subproofId(${payout.subproofId}) on symbols ${payout.name} not match`);
                            EXIT_HERE;
                        }
                        payout.subproofId = payout.airGroupId;
                        delete payout.airGroupId;
                    }
                }
                this.pilOut.symbols.push(payout);
            } catch (e) {
                console.log(e.stack)
                throw new Error(`ERROR exporting proto symbol ${name}: ` + e.message);
            }
        }
    }

    symbolType2Proto(type, id, ref) {
        switch(type) {
            case 'im':
                return {type: REF_TYPE_IM_COL, id};

            case 'fixed': {
                const [ftype, protoId] = this.fixedId2ProtoId[id];
                if (ftype === 'P') return {type: REF_TYPE_PERIODIC_COL, id: protoId};
                return {type: REF_TYPE_FIXED_COL, id: protoId, stage: 0};
            }

            case 'witness': {
                const [stage, protoId] = this.witnessId2ProtoId[id];
                return {type: REF_TYPE_WITNESS_COL, id: protoId, stage};
            }
            case 'airgroupvalue': {
                const protoId = assert.returnTypeOf(this.airGroupValueId2ProtoId[id], 'number');
                console.log(ref.data);
                if (this.version >= 2) {
                    return {type: REF_TYPE_AIR_GROUP_VALUE, id: protoId, airgroupId: ref.data.airGroupId};
                } else {
                    return {type: REF_TYPE_AIR_GROUP_VALUE, id: protoId, subproofId: ref.data.airGroupId};
                }
            }
            case 'proofvalue':
                return {type: REF_TYPE_PROOF_VALUE, id};

            case 'public':
                return {type: REF_TYPE_PUBLIC_VALUE, id};

            case 'challenge': {
                const [protoId, stage] = this.challengeId2Proto[id];
                const res = {type: REF_TYPE_CHALLENGE, id: protoId, stage};
                return res;
            }

        }
        throw new Error(`Invalid symbol type ${type}`);
    }

    setPublics(publics) {
        this.pilOut.numPublicValues = publics.length;
    }
    setProofValues(proofvalues) {
        this.pilOut.numProofValues = proofvalues.length;
    }
    setFixedCols(fixedCols) {    
        this.setConstantCols(fixedCols, this.currentAir.numRows, false);
    }
    setPeriodicCols(periodicCols) {
        this.setConstantCols(periodicCols, this.currentAir.numRows, true);
    }
    setChallenges(challenges) {
        const values = challenges.getPropertyValues(['id', 'stage']);
        const valuesSortedByStageAndId = values.sort((a,b) => (a[1] > b[1] || (a[1] == b[1] && a[0] > b[0])) ? 1 : -1);
        let previousStage = false;
        let protoId;
        let countByStage = [];
        this.challengeId2Proto = [];
        for (const [id, stage] of valuesSortedByStageAndId) {
            if (previousStage !== stage) {
                previousStage = stage;
                protoId = 0;
            }
            assert.ok(stage > 0);
            countByStage[stage-1] = (countByStage[stage-1] ?? 0) + 1;
            this.challengeId2Proto[id] = [protoId, stage];
            ++protoId;
        }
        this.pilOut.numChallenges = Array.from(countByStage, x => x ?? 0);
    }
    setConstantCols(cols, rows, periodic) {
        const property = periodic ? 'periodicCols':'fixedCols';
        const airCols = this.setupAirProperty(property);

        const colType = periodic ? 'P':'F';
        for (const col of cols) {
            const colIsPeriodic = col.isPeriodic() && col.rows < rows;
            if (colIsPeriodic !== periodic) continue;        
            const _rows = periodic ? col.rows : rows;
            console.log(`SET ${col.id} ${col.constructor.name} ${_rows} ${colIsPeriodic}`);
            this.fixedId2ProtoId[col.id] = [colType, airCols.length];
            let values = [];
            for (let irow = 0; irow < _rows; ++irow) {
                const _value = col.getValue(irow);
                if (typeof _value === 'undefined') {
                    console.log(irow, col);
                    throw new Error(`Error ${col.constructor.name} on row ${irow}`);
                }
                values.push(this.toBaseField(_value));
            }
            airCols.push({values});
        }
    }
    setWitnessCols(cols) {
        const stageWidths = this.setupAirProperty('stageWidths');
        // sort by stage
        this.witnessId2ProtoId = [];
        let stages = [];
        for (const col of cols) {
            if (col.stage < 1) {
                throw new Error(`Invalid stage ${col.stage}`);
            }
            const stageIndex = col.stage - 1;
            if (typeof stages[stageIndex] === 'undefined') {
                stages[stageIndex] = [];
            }
            stages[stageIndex].push(col.id);
        }
        let stageId = 0;
        for (const _stage of stages) {
            const stage = _stage ?? []; // stages without elements
            ++stageId;      // stageId starts by 1 (stage0 constant generation)

            stageWidths.push(stage.length);

            // colIdx must be relative stage
            let index = 0;
            for (const witnessId of stage) {
                this.witnessId2ProtoId[witnessId] = [stageId, index++];
            }
        }
    }
    setExpressions(packedExpressions) {
        const expressions = this.setupAirProperty('expressions');
        this._setExpressions(expressions, packedExpressions);
    }
    setGlobalExpressions(packedExpressions) {
        this._setExpressions(this.pilOut.expressions, packedExpressions);
    }
    _setExpressions(expressions, packedExpressions) {
        for (const packedExpression of packedExpressions) {
            const e = cloneDeep(packedExpression);
            const [op] = Object.keys(e);
            switch (op) {
                case 'mul':
                case 'add':
                case 'sub':
                    this.translate(e[op].lhs);
                    this.translate(e[op].rhs);
                    break;
                case 'neg':
                    this.translate(e[op].value);
                    break;
                default:
                    throw new Error(`Invalid operation ${op} on packedExpression`);
            }
            expressions.push(e);
        }
    }
    translate(ope) {
        const [key] = Object.keys(ope);
        switch (key) {
            case 'fixedCol': {
                    // inside pil all fixed columns are equal, after that detect periodic cols
                    // and it implies change index number and type if finally is a periodic col.
                    const [type, protoId] = this.fixedId2ProtoId[ope.fixedCol.idx] ?? [false,false];
                    if (protoId === false) {
                        console.log(ope);
                        throw new Error(`Translate: Found invalid fixedColId ${ope.fixedCol.idx}`);
                    }
                    ope.fixedCol.colIdx = protoId;
                    if (type === 'P') {
                        ope.periodicCol = ope.fixedCol;
                        delete(ope.fixedCol);
                    }
                }
                break;

            case 'witnessCol': {
                    // translate index of witness because witness cols must be order by stage and
                    // it implies change index number.
                    const [stage, protoId] = this.witnessId2ProtoId[ope.witnessCol.colIdx] ?? [false, false];
                    // console.log(`TRANSLATE witnessCol colIdx:${ope.witnessCol.colIdx}=>${protoId} rowOffset:${ope.witnessCol.rowOffset} stage:${ope.witnessCol.stage}=>${stage}`);
                    if (protoId === false) {
                        throw new Error(`Translate: Found invalid witnessColId ${ope.witnessCol.colIdx}`);
                    }
                    ope.witnessCol.colIdx = protoId;
                    ope.witnessCol.stage = stage;
                }
                break;
            case 'subproofValue': {
                    const protoId = this.airGroupValueId2ProtoId[ope.subproofValue.idx] ?? false;
                    if (protoId === false) {
                        throw new Error(`Translate: Found invalid subproofValue idx ${ope.subproofValue.idx}`);
                    }
                    ope.subproofValue.idx = protoId;        
                }
                break;
            case 'challenge': {
                    /* const id = ope.challenge.idx;
                    const [protoId, stage] = this.challengeId2Proto[id] ?? [false, false];
                    if (protoId === false) {
                        console.log(ope);
                        throw new Error(`Translate: Found invalid subproofvalue ${id}`);
                    }
                    ope.challenge.idx = protoId;
                    ope.challenge.stage = stage;*/
                }
                break;
            case 'constant':
                ope.constant.value = this.toBaseField(ope.constant.value);
                break;
        }
    }
    setupAirProperty(propname, init = []) {
        if (this.currentAir === null) {
            throw new Error('Current air not defined');
        }
        if (typeof this.currentAir[propname] !== 'undefined') {
            throw new Error(`Property ${propname} already defined on current air ${this.currentAir.name || 'unnamed'}`);
        }
        this.currentAir[propname] = init;
        return this.currentAir[propname];
    }
    setGlobalConstraints(constraints, packed) {
        for (const [index, constraint] of constraints.keyValues()) {
            const packedExpressionId = constraints.getPackedExpressionId(constraint.exprId, packed);
            let payload = { expressionIdx: { idx: packedExpressionId },
                            debugLine: '###'+constraints.getDebugInfo(index, packed) };
            this.pilOut.constraints.push(payload);
        }
    }
    setConstraints(constraints, packed, options = {}) {
        let airConstraints = this.setupAirProperty('constraints');
        for (const [index, constraint] of constraints.keyValues()) {
            let payload;
            const debugLine = constraints.getDebugInfo(index, packed, options);
            const packedExpressionId = constraints.getPackedExpressionId(constraint.exprId, packed, options);
            switch (constraint.boundery) {
                case false:
                case 'all':
                    payload = { everyRow: { expressionIdx: { idx: packedExpressionId }, debugLine}};
                    break;

                case 'first':
                    payload = { firstRow: { expressionIdx: { idx: packedExpressionId }, debugLine}};
                    break;

                case 'last':
                    payload = { lastRow: { expressionIdx: { idx: packedExpressionId }, debugLine}};
                    break;

                case 'frame':
                    payload = { everyFrame: { expressionIdx: { idx: packedExpressionId }, offsetMin: 0, offsetMax:0, debugLine}};
                    break;

                default:
                    throw new Error(`Invalid constraint boundery '${constraint.boundery}'`);

            }
            airConstraints.push(payload);
        }
    }
    addHints(hints, packed, options) {
        const airGroupId = options.airGroupId ?? false;
        const airId = options.airId ?? false;
        for (const hint of hints) {
            let payload = {name: hint.name};
            if (airGroupId !== false) {
                payload.subproofId = airGroupId;
                payload.airId = airId;
            }
            const res = this.toHintField(hint.data, {...options, hints, packed})
            payload.hintFields = Array.isArray(res) ? res: [res];

            // TODO
            // const debugLine = hints.getDebugInfo(hint, packed, options);
            this.pilOut.hints.push(payload);
        }
    }
    toHintField(hdata, options = {}) {
        const path = options.path ?? '';
        // check if an alone expression to use and translate its single operand
        if (hdata && hdata.isArray) {
            hdata = hdata.getAloneOperand().toArrays();
        }
        if (Array.isArray(hdata)) {
            let result = [];
            for (let index = 0; index < hdata.length; ++index) {
                result.push(this.toHintField(hdata[index], {...options, path: path + '[' + index + ']'}));
            }
            return { hintFieldArray: { hintFields: Array.isArray(result) ? result : [result] }};
        }
        if (hdata && typeof hdata.pack === 'function') {
            // console.log('HINT', typeof hdata.toString == 'function' ? hdata.constructor.name + ' ==> ' + hdata.toString() : hdata);
            if (typeof hdata.evalAsValue === 'function') {
                const value = hdata.evalAsValue();
                if (value.isString) {
                    return { stringValue: value.asString() };
                }
            }
            const expressionId = hdata.pack(options.packed, options);
            return { operand: { expression: { idx: expressionId } }};
        }
        if (typeof hdata === 'object' && hdata.constructor.name === 'ExpressionId') {
            const expressionId = options.hints.getPackedExpressionId(hdata.id, options.packed, options);
            if (expressionId === false) {
                const expr = options.hints.expressions.get(hdata.id);
                options.hints.getPackedExpressionId(hdata.id, options.packed, options);
            }
            return { operand: { expression: { idx: expressionId } }};
        }
        if (typeof hdata === 'bigint' || typeof hdata === 'number') {
            return { operand: {constant: { value: this.bint2buf(BigInt(hdata))}} }
        }
        if (typeof hdata === 'string') {
            return { stringValue: hdata };
        }
        if (hdata instanceof StringValue) {
            return { stringValue: hdata.asString() };
        }
        if (typeof hdata === 'object' && hdata.constructor.name === 'Object') {
            let result = [];
            for (const name in hdata) {
                const value = this.toHintField(hdata[name], {...options, path: path + '.' + name});
                result.push({...value, name});
            }
            return { hintFieldArray: { hintFields: Array.isArray(result) ? result : [result] }};
        }
        throw new Error(`Invalid hint-data (type:${typeof hdata}/${(hdata.constructor ?? {name:''}).name}) on cloneHint of ${path}`);
    }
    bint2uint8(value, bytes = 0) {
        let result = new Uint8Array(this.uint8size);
        for (let index = 0; index < this.uint8size; ++index) {
            result[this.uint8size - index - 1] = value & 0xFF;
            value = value >> 8;
        }
        assert.strictEqual(value, 0n);
        return result;
    }
    bint2bint(value, bytes = 0) {
        return BigInt(value);
    }
    bint2buf(value, bytes = 0, useFr = true) {
        if (value && typeof value.asInt === 'function') {
            value = value.asInt();
        }
        if (this.bigIntType === 'bigint') {
            return BigInt(value);
        }
        if (value === 0n && bytes === 0) {
            return Buffer.alloc(0);
        }

        if (typeof value !== 'bigint') {
            if (value && value.dump) {
                value.dump();
            }
        }
        if (useFr) {
            value = Context.Fr.e(value);
        }

        // first divide in chunks to calculate how many chunks in 
        // big endian are used.
        let chunks = [];
        while (value > 0n) {
            chunks.push(value & 0xFFFFFFFFFFFFFFFFn)
            value = value >> 64n;
        }
        if (chunks.length === 0) {
            chunks.push(0n);
        }

        // write precalculated chunks
        const buf = Buffer.alloc(chunks.length * 8);
        const lastIndex = chunks.length - 1;
        for (let index = 0; index <= lastIndex; ++index) {
            buf.writeBigUInt64BE(chunks[lastIndex - index], index);
        }
        if (bytes === 0 && this.varbytes) {
            let index = 0;
            if (buf[0] == 0) {
                while (buf[++index] == 0 && index < 32);
            }
            return buf.subarray(index);
        }
        if (bytes !== 0) {
            return buf.subarray(32-bytes);
        }
        return buf;
    }
    buf2bint(buf) {
        let value = 0n;
        let offset = 0;
        while ((buf.length - offset) >= 8) {
            value = (value << 64n) + buf.readBigUInt64BE(offset);
            offset += 8;
        }
        while ((buf.length - offset) >= 4) {
            value = (value << 32n) + BigInt(buf.readUInt32BE(offset));
            offset += 4;
        }
        while ((buf.length - offset) >= 2) {
            value = (value << 16n) + BigInt(buf.readUInt16BE(offset));
            offset += 2;
        }
        while ((buf.length - offset) >= 1) {
            value = (value << 8n) + BigInt(buf.readUInt8(offset));
            offset += 1;
        }
        return value;
    }
    exportToFile() {
        /*
        let pilout = {
            name: 'myname',
            baseField:
        }
        const root = await protobuf.load(__dirname + '/pilout.proto');

        const PilOut = root.lookupType('pilout.PilOut');
        console.log(PilOut);
        */
    }
    updateSymbolsWithSameName() {
        console.log(this.pilOut.symbols.map(x => `${x.name}__${this.version >= 2 ? x.airGroupId:x.subproofId}${typeof x.airId === 'undefined' ? '':('__'+x.airId)}`));
    }
}

let pout = new module.exports();
