const fs = require('fs');
const protobuf = require('protobufjs');
const argv = require("yargs")
    .usage("airout <pilout.file>")
    .argv;

const AGGREGATION_TYPES = {
    SUM: 0,
    PROD: 1,
};

const SYMBOL_TYPES = {
    IM_COL: 0,
    FIXED_COL: 1,
    PERIODIC_COL: 2,
    WITNESS_COL: 3,
    PROOF_VALUE: 4,
    SUBPROOF_VALUE: 5,
    PUBLIC_VALUE: 6,
    PUBLIC_TABLE: 7,
    CHALLENGE: 8,
};

const HINT_FIELD_TYPES = {
    STRING: 0,
    OPERAND: 1,
    ARRAY: 2,
};

const airoutProto = require.resolve('../src/pilout.proto');
const log = { 
            info: (tag, module) => console.log(tag + module),
        };

class AirOut {
    constructor(airoutFilename) {
        log.info("[AirOut    ]", "··· Loading airout...");

        const airoutEncoded = fs.readFileSync(airoutFilename);
        const AirOut = protobuf.loadSync(airoutProto).lookupType("PilOut");

        const decoded = AirOut.decode(airoutEncoded);
        Object.assign(this, AirOut.toObject(decoded));

        this.preprocessAirout();

        this.printInfo();
        this.verifyExpressions();
        this.verifyHints();
    }   

    preprocessAirout() {
        for(let i=0; i<this.subproofs.length; i++) {
            const subproof = this.subproofs[i];
            subproof.subproofId = i;

            const subAirValues = this.getSubAirValuesBySubproofId(i);

            for(let j=0; j<subproof.airs.length; j++) {
                const air = subproof.airs[j];
                air.subproofId = i;
                air.airId = j;

                air.symbols = this.getSymbolsBySubproofIdAirId(subproof.subproofId, air.airId);

                for(const subAirValue of subAirValues) {
                    air.symbols.push( { ...subAirValue, airId: j });
                }
                air.hints = this.getHintsBySubproofIdAirId(subproof.subproofId, air.airId);
                air.numChallenges = this.numChallenges;
                air.aggregationTypes = subproof.subproofvalues;
            }
        }
    }

    printInfo() {
        log.info("[AirOut    ]", `··· AirOut Info`);
        log.info("[AirOut    ]", `    Name: ${this.name}`);
        log.info("[AirOut    ]", `    #Subproofs: ${this.subproofs.length}`);

        log.info("[AirOut    ]", `    #ProofValues: ${this.numProofValues}`);
        log.info("[AirOut    ]", `    #PublicValues: ${this.numPublicValues}`);

        if(this.publicTables) log.info("[AirOut    ]", `    #PublicTables: ${this.publicTables.length}`);
        if(this.expressions) log.info("[AirOut    ]", `    #Expressions: ${this.expressions.length}`);
        if(this.constraints) log.info("[AirOut    ]", `    #Constraints: ${this.constraints.length}`);
        if(this.hints) log.info("[AirOut    ]", `    #Hints: ${this.hints.length}`);
        if(this.symbols) log.info("[AirOut    ]", `    #Symbols: ${this.symbols.length}`);

        for(const subproof of this.subproofs) this.printSubproofInfo(subproof);
    }

    printSubproofInfo(subproof) {
        log.info("[AirOut    ]", `    > Subproof '${subproof.name}':`);

        for(const air of subproof.airs) this.printAirInfo(air);
    }

    printAirInfo(air) {
        log.info("[AirOut    ]", `       + Air '${air.name}'`);
        log.info("[AirOut    ]", `         NumRows:     ${air.numRows}`);
        log.info("[AirOut    ]", `         Stages:      ${air.stageWidths.length}`);
        log.info("[AirOut    ]", `         Expressions: ${air.expressions.length}`);
        log.info("[AirOut    ]", `         Constraints: ${air.constraints.length}`);
    }

    get numSubproofs() {
        return this.subproofs === undefined ? 0 : this.subproofs.length;
    }

    get numStages() {
        return this.numChallenges?.length ?? 1;
    }

    getSubproofById(subproofId) {
        if(this.subproofs === undefined) return undefined;

        return this.subproofs[subproofId];
    }

    getAirBySubproofIdAirId(subproofId, airId) {
        if(this.subproofs === undefined) return undefined;
        if(this.subproofs[subproofId].airs === undefined) return undefined;

        const air = this.subproofs[subproofId].airs[airId];
        air.subproofId = subproofId;
        air.airId = airId;
        return air;
    }

    getNumChallenges(stageId) {
        if(this.numChallenges === undefined) return 0;

        return this.numChallenges[stageId - 1];
    }

    //TODO access to AirOut numPublicValues ?

    //TODO access to AirOut AirOutPublicTables ?

    getExpressionById(expressionId) {
        if(this.expressions === undefined) return undefined;

        return this.expressions[expressionId];
    }

    getSymbolById(symbolId) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.id === symbolId);
    }

    getSymbolByName(name) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.name === name);
    }

    getSymbolsBySubproofId(subproofId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.subproofId === subproofId);
    }

    getSubAirValuesBySubproofId(subproofId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.subproofId === subproofId && symbol.type === SYMBOL_TYPES.SUBPROOF_VALUE && symbol.airId === undefined);
    }

    getSymbolsByAirId(airId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.airId === airId);
    }

    getSymbolsBySubproofIdAirId(subproofId, airId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(
            (symbol) => (symbol.subproofId === undefined) || (symbol.subproofId === subproofId && symbol.airId === airId));
    }

    getSymbolsByStage(subproofId, airId, stageId, symbolType) {
        if (this.symbols === undefined) return [];
    
        const symbols = this.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            symbol.stage === stageId &&
            (symbolType === undefined || symbol.type === symbolType)
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }

    getColsBySubproofIdAirId(subproofId, airId) {
        if (this.symbols === undefined) return [];
    
        const symbols = this.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            ([1, 2, 3].includes(symbol.type))
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }

    getWitnessSymbolsByStage(subproofId, airId, stageId) {
        return this.getSymbolsByStage(subproofId, airId, stageId, SYMBOL_TYPES.WITNESS_COL);
    }

    getSymbolByName(name) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.name === name);
    }

    getHintById(hintId) {
        if(this.hints === undefined) return undefined;

        return this.hints[hintId];
    }

    getHintsBySubproofId(subproofId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(hint => hint.subproofId === subproofId);
    }

    getHintsByAirId(airId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(hint => hint.airId === airId);
    }

    getHintsBySubproofIdAirId(subproofId, airId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(
            (hint) => (hint.subproofId === undefined) || ( hint.subproofId === subproofId && hint.airId === airId));
    }
    verifyExpressions() {
        for (let subproofId = 0; subproofId < this.subproofs.length; ++subproofId) {
            for (let airId = 0; airId < this.subproofs[subproofId].airs.length; ++airId) {
                this.verifyAirExpressions(subproofId, airId);
            }
        }
    }
    verifyHints() {
        for (let hintId = 0; hintId < this.hints.length; ++hintId) {
            const hint = this.hints[hintId];
            const name = hint.name;
            const subproofId = hint.subproofId;
            const airId = hint.airId;
            const expressions = this.subproofs[subproofId].airs[airId].expressions;
            let referenced = new Array(expressions.length).fill(false);
            let ctx = {path: '', subproofId, airId, expressions, referenced};
            for (let hintFieldId = 0; hintFieldId < hint.hintFields.length; ++hintFieldId) {
                ctx.path = `[S:${subproofId} A:${airId}] ${name} [${hintFieldId}]`;
                console.log(`VERIFY HINT FIELD ${ctx.path} subproof:${subproofId} air:${airId}`);
                this.verifyHintField(ctx, hintFieldId, hint.hintFields[hintFieldId]);
            }
        }
    }
    verifyHintField(ctx, index, hintField) {
        const name = (hintField.name ?? '#noname#') + '[' + index + ']';
        const cls = Object.keys(hintField).filter(x => x !== 'name')[0];
        const data = hintField[cls];
        const _ctxpath = ctx.path;
        switch (cls) {       
            case 'stringValue':
                break;
            case 'operand':
                ctx.path = `${_ctxpath}${name}`;
                this.verifyExpressionOperand(ctx, data);
                break;
            case 'hintFieldArray': {
                for (let hintFieldIndex = 0; hintFieldIndex < data.hintFields.length; ++hintFieldIndex) {                    
                    ctx.path = `${_ctxpath}${name}[${hintFieldIndex}]`;                        
                    this.verifyHintField(ctx, hintFieldIndex, data.hintFields[hintFieldIndex]);
                }
                break;
            }
            default:
                throw new Error(`${_ctxpath} @${name} invalid cls:${cls}`);            
        }
        ctx.path = _ctxpath;
    }
    verifyAirExpressions(subproofId, airId) {
        const expressions = this.subproofs[subproofId].airs[airId].expressions;
        const expressionsCount = expressions.length;
        // TODO: detect circular dependencies   
        let referenced = new Array(expressionsCount).fill(false);
        let ctx = {path: `[subproof:${subproofId} air:${airId}]`, referenced, expressions};
        for (let expressionId = 0; expressionId < expressionsCount; ++expressionId) {
            ctx.referenced[expressionId] = true;            
            this.verifyExpression(ctx, expressionId, expressions[expressionId]);
            ctx.referenced[expressionId] = false;            
        }        
    }
    verifyExpression(ctx, idx, expression) {
        const cls = Object.keys(expression)[0];
        const data = expression[cls];
        const _ctxpath = ctx.path;
        switch (cls) {
            case 'add':
            case 'sub':
            case 'mul': 
                ctx.path = _ctxpath + `[@${idx} ${cls} lhs]`;
                this.verifyExpressionOperand(ctx, data.lhs);
                ctx.path = _ctxpath + `[@${idx} ${cls} rhs]`;
                break;
            case 'neg':
                ctx.path = _ctxpath + `[@${idx} ${cls} value]`;
                this.verifyExpressionOperand(ctx, data.value);
                break;
            default:
                throw new Error(`${_ctxpath} @${idx} invalid cls:${cls}`);
        }
        ctx.path = _ctxpath;
    }
    verifyExpressionOperand(ctx, operand) {
        const cls = Object.keys(operand)[0];
        const data = operand[cls];
        switch (cls) {
            case 'constant':    
                break;
            case 'challenge':
                // TODO: verify challenge
                break;
            case 'proofValue':
                // TODO: verify proofValue
                break;
            case 'subproofValue':
                // TODO: verify subproofValue
                break;
            case 'publicValue':
                // TODO: verify publicValue
                break;
            case 'periodicCol':
                // TODO: verify periodicCol
                break;
            case 'fixedCol':
                // TODO: verify fixedCol
                break;
            case 'witnessCol':
                // TODO: verify witnessCol
                break;
            case 'fixedCol':                
                // TODO: verify fixedCol
                break;
            case 'expression': {
                    const idx = data.idx;
                    if (idx >= ctx.expressions.length) {
                        throw new Error(`${ctx.path} invalid expression idx:${idx}`);
                        // console.log(`ERROR !!! ${ctx.path} invalid expression idx:${idx} [max:${ctx.expressions.length - 1}]`);
                        // break;
                    }
                    if (ctx.referenced[idx]) {
                        throw new Error(`${ctx.path} circular reference idx:${idx}`);
                    }
                    ctx.referenced[idx] = true;
                    this.verifyExpression(ctx, idx, ctx.expressions[idx]);
                    ctx.referenced[idx] = false;
                }
                break;
            default:
                throw new Error(`invalid cls:${cls}`);
        }
    }
}

module.exports = {
    AirOut,
    AGGREGATION_TYPES,
    SYMBOL_TYPES,
    HINT_FIELD_TYPES,
};

const airOut = new AirOut(argv._[0]);
