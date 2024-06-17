const { performance } = require('perf_hooks');
const Scope = require("./scope.js");
const Expressions = require("./expressions.js");
const Expression = require("./expression.js");
const Definitions = require("./definitions.js");
const References = require("./references.js");
const Indexable = require("./indexable.js");
const Ids = require("./ids.js");
const Constraints = require("./constraints.js");
const Subproof = require("./subproof.js");
const Subproofs = require("./subproofs.js");
const Air = require("./air.js");
const Airs = require("./airs.js");
const Variables = require("./variables.js");
const Sequence = require("./sequence.js");
const List = require("./list.js");
const Assign = require("./assign.js");
const Function = require("./function.js");
const SubproofFunction = require("./subproof_function.js");
const PackedExpressions = require("./packed_expressions.js");
const ProtoOut = require("./proto_out.js");
const FixedCols = require("./fixed_cols.js");
const WitnessCols = require("./witness_cols.js");
const SubproofValues = require("./subproof_values.js");
const Iterator = require("./iterator.js");
const Context = require("./context.js");
const Runtime = require("./runtime.js");
// const FunctionCall = require("./function_call.js");
const {FlowAbortCmd, BreakCmd, ContinueCmd, ReturnCmd} = require("./flow_cmd.js")
// const {ReferenceItem, ExpressionItem, FeValue, IntValue, ProofItem, Proofval, Subproofval, Challenge, Public, ProofStageItem,
//       ExpressionReference, StringValue, FixedCol, WitnessCol } = require("./expression_items.js");

const ExpressionItems = require("./expression_items.js");
const ExpressionItem = ExpressionItems.ExpressionItem;
const DefinitionItems = require("./definition_items.js");
const fs = require('fs');
const { log2, getKs, getRoots } = require("./utils.js");
const Hints = require('./hints.js');
const util = require('util');
const Debug = require('./debug.js');
const Transpiler = require('./transpiler.js');
const assert = require('./assert.js');

const MAX_SWITCH_CASE_RANGE = 512;
module.exports = class Processor {
    constructor (Fr, parent, config = {}) {
        this.lastMs = Math.floor(performance.now());
        this.sourceRef = '(processor constructor)';
        this.compiler = parent;
        this.trace = true;
        this.Fr = Fr;
        this.prime = Fr.p;
        this.references = new References();
        this.scope = new Scope();
        this.runtime = new Runtime();
        this.context = new Context(this.Fr, this, config);
        this.nextStatementTranspile = false;
        this.nextStatementFixed = false;
        this.loadedRequire = {};

        this.scope.mark('proof');
        this.delayedCalls = {};
        this.timers = {};

        this.lastSubproofId = -1;
        this.lastAirId = -1;
        this.airId = 0;
        this.subproofId = 0;

        this.ints = new Variables('int', DefinitionItems.IntVariable, ExpressionItems.IntValue);
        this.references.register('int', this.ints);

        this.fes = new Variables('fe', DefinitionItems.FeVariable, ExpressionItems.FeValue);
        this.references.register('fe', this.fes);

        this.strings = new Variables('string', DefinitionItems.StringVariable, ExpressionItems.StringValue);
        this.references.register('string', this.strings);

        this.exprs = new Variables('expr', DefinitionItems.ExpressionVariable, Expression, {constClass: ExpressionItems.ExpressionReference});
        this.references.register('expr', this.exprs);

        // this.lexprs = new Variables('lexpr', Expression);
        // this.references.register('lexpr', this.lexprs);

        this.fixeds = new FixedCols();
        ExpressionItem.setManager(ExpressionItems.FixedCol, this.fixeds);
        this.fixeds.runtimeRows = true;
        this.references.register('fixed', this.fixeds);

        this.witness = new WitnessCols();
        ExpressionItem.setManager(ExpressionItems.WitnessCol, this.witness);
        this.references.register('witness', this.witness);

//        this.constants = new Indexable('constant', IntValue);
//        this.references.register('constant', this.constants);

        this.publics = new Indexable('public', DefinitionItems.Public, ExpressionItems.Public);
        ExpressionItem.setManager(ExpressionItems.Public, this.publics);
        this.references.register('public', this.publics);

        this.challenges = new Indexable('challenge', DefinitionItems.Challenge, ExpressionItems.Challenge);
        ExpressionItem.setManager(ExpressionItems.Challenge, this.challenges);
        this.references.register('challenge', this.challenges);

        this.proofvalues = new Indexable('proofvalue', DefinitionItems.Proofval, ExpressionItems.Proofval);
        ExpressionItem.setManager(ExpressionItems.Proofval, this.proofvalues);
        this.references.register('proofvalue', this.proofvalues);

        this.subproofvalues = new SubproofValues();
        ExpressionItem.setManager(ExpressionItems.Subproofval, this.subproofvalues);
        this.references.register('subproofvalue', this.subproofvalues);

        this.functions = new Indexable('function', Function, ExpressionItems.FunctionCall, {const: true});
        ExpressionItem.setManager(ExpressionItems.FunctionCall, this.functions);
        this.references.register('function', this.functions);

        this.subproofs = new Subproofs();

        this.expressions = new Expressions();
        this.globalExpressions = new Expressions();

        // this.references.register('im', this.expressions);

        this.constraints = new Constraints();
        this.globalConstraints = new Constraints(this.globalExpressions);

        this.assign = new Assign(Fr, this, this.context, this.references, this.expressions);
        this.hints = new Hints(Fr, this.expressions);

        this.executeCounter = 0;
        this.executeStatementCounter = 0;
        this.functionDeep = 0;
        this.callstack = []; // TODO
        this.breakpoints = ['expr.pil:26'];
        this.sourceRef = '(built-in-class)';
        this.loadBuiltInClass();
        this.scopeType = 'proof';
        this.currentSubproof = false;

        this.sourceRef = '(init)';

        this.proto = new ProtoOut(this.Fr);
        this.proto.setupPilOut(Context.config.name ?? 'noname');

        this.transpiler = new Transpiler({processor: this});
        if (typeof Context.config.test.onProcessorInit === 'function') {
            Context.config.test.onProcessorInit(this);
        }
    }
    loadBuiltInClass() {
        const filenames = fs.readdirSync(__dirname + '/builtin');
        this.builtIn = {};
        for (const filename of filenames) {
            if (!filename.endsWith('.js')) continue;
            if (Context.config.debug.builtInLoad) {
                console.log(`Loading builtin ${filename}.....`);
            }
            if (Debug.active) console.log(filename);
            const builtInCls = require(__dirname + '/builtin/'+ filename);
            const builtInObj = new builtInCls(this);
            this.builtIn[builtInObj.name] = builtInObj;
            this.references.declare(builtInObj.name, 'function', [], {}, builtInObj);
        }
    }
    insideFunction() {
        return this.functionDeep > 0;
    }
    declareBuiltInConstants() {
        this.references.declare('PRIME', 'int', [], { global: true, sourceRef: this.sourceRef, const: true }, this.prime);
        this.references.declare('BITS', 'int', [], { global: true, sourceRef: this.sourceRef });
        this.references.declare('SUBPROOF', 'string', [], { global: true, sourceRef: this.sourceRef });
        this.references.declare('SUBPROOF_ID', 'int', [], { global: true, sourceRef: this.sourceRef });
        this.references.declare('AIR_ID', 'int', [], { global: true, sourceRef: this.sourceRef });
    }
    startExecution(statements) {
        this.sourceRef = '(start-execution)';

        this.declareBuiltInConstants();
        this.scope.pushInstanceType('proof');
        this.sourceRef = '(execution)';
        this.execute(statements);
        this.sourceRef = '(subproof-execution)';
        this.finalClosingSubproofs();
        this.finalProofScope();
        this.scope.popInstanceType();
        this.generateProtoOut();
    }
    generateProtoOut()
    {        
        if (Context.config.protoOut === false) return;
        this.proto.setPublics(this.publics);
        this.proto.setProofvalues(this.proofvalues);
        this.proto.setChallenges(this.challenges);
        let packed = new PackedExpressions();
        this.globalExpressions.pack(packed);
        this.proto.setGlobalConstraints(this.globalConstraints, packed);
        this.proto.setGlobalExpressions(packed);
        this.proto.setGlobalSymbols(this.references);
        this.proto.encode();
        this.proto.saveToFile(Context.config.outputFile);
    }
    traceLog(text, color = '') {
        if (!this.trace) return;
        if (Debug.active) {
            console.log([Expression.constructor.name]);
            if (color) console.log(`\x1B[${color}m${text}\x1B[0m`);
            else console.log(text);
        }
    }
    execute(statements, label = '') {
        const __executeCounter = this.executeCounter++;
        const lstatements = Array.isArray(statements) ? statements : [statements];
        // console.log(`## DEBUG ## ${this.executeCounter}[${lstatements.length}]`)
        // console.log(`\x1B[45m====> ${lstatements[0].type}\x1B[0m`);
        const firstBlockStatement = lstatements.length > 0 ? lstatements[0] : {debug:''};
        let __label = label ? label : (firstBlockStatement.debug ?? '');
        this.traceLog(`[TRACE-BLOCK] #${__executeCounter} ${__label} (DEEP:${this.scope.deep})`, '38;5;51');
        for (const st of lstatements) {
            const result = this.executeStatement(st);
            if (result instanceof FlowAbortCmd) {
                __label = label ? label : (st.debug ?? '');
                this.traceLog(`[TRACE-ABORT::${result.constructor.name}#${result.id}] #${__executeCounter} ${__label} (DEEP:${this.scope.deep})`,'38;5;51;48;5;16');
                return result;
            }
        }
    }
    executeStatement(st) {
        const __executeStatementCounter = this.executeStatementCounter++;
        let activeTranspile = this.nextStatementTranspile;
        if (activeTranspile) {
            this.transpile = true;
            this.nextStatementTranspile = false;
        }
        this.traceLog(`[TRACE] #${__executeStatementCounter} ${st.debug ?? ''} (DEEP:${this.scope.deep})`, '38;5;75');

        this.sourceRef = st.debug ? (st.debug.split(':').slice(0,2).join(':') ?? ''):'';
        // if (st instanceof ExpressionItem) {
        //     const res = st.instance();
        //     return res;
        // }
        if (typeof st.type === 'undefined') {
            console.log(st);
            this.error(st, `Invalid statement (without type)`);
        }
        const method = ('exec_'+st.type).replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase());
        if (Debug.active) console.log(`## DEBUG ## ${this.executeCounter}.${this.executeStatementCounter} ${method} ${st.debug}` );
        if (!(method in this)) {
            console.log('==== ERROR ====');
            this.error(st, `Invalid statement type: ${st.type}`);
        }
        let res;
        try {
            if (this.breakpoints.includes(st.debug)) {
                debugger;
            }
            if (this.transpile) {
                this.transpiler.transpile(st);
                EXIT_HERE;
            } else {
                res = this[method](st);
            }
        } catch (e) {
            // console.log([Expression.constructor.name]);
            console.log("EXCEPTION ON "+st.debug+" ("+this.callstack.join(' > ')+")");
            if (activeTranspile) {
                this.transpile = false;
            }
            throw e;
        }
        if (activeTranspile) {
            this.transpile = false;
        }
        return res;
    }
    execPragma(st) {
        const params = st.value.split(/\s+/);
        const instr = params[0] ?? false;
        switch (instr) {
            case 'message':
                    const ms = Math.floor(performance.now());
                    console.log(`\x1B[46m${st.value.slice(8)} (${ms}ms +${ms-this.lastMs}ms)\x1B[0m`);
                    this.lastMs = ms;
                    break;
            case 'debug':
                if (params[1] === 'on') {
                    Debug.active = true;
                    console.log('##############');
                    console.log('## DEBUG ON ##');
                    console.log('##############');
                }
                else if (params[1] === 'off') Debug.active = false;        
                break;
            case 'profile':
                if (params[1] === 'on') {
                    console.profile();
                }
                else if (params[1] === 'off') {
                    console.profileEnd();
                }        
                break;
            case 'exit':
                EXIT_HERE;
                break;
            case 'timer': {
                const name = params[1] ?? false;
                const action = params[2] ?? 'start';
                if (action === 'start')  {
                    this.timers[name] = process.hrtime();
                } else if (action === 'end') {
                    const now = process.hrtime();
                    const start = this.timers[name] ?? now;
                    const milliseconds = (now[0] - start[0]) * 1000 + Math.floor((now[1] - start[1])/1000000);
                    console.log(`=========================> TIMER ${name} ${milliseconds} ms <===============================`);
                }
                break;
            }
            case 'debugger':
                debugger;
                break;  
            case 'transpile':
                this.nextStatementTranspile = true;
                break;
            case 'fixed':
                this.nextStatementFixed = true;
                break;
            case 'dump': {                
                const value = this.references.get(params[1]).value;
                value.dump('*************** PRAGMA '+Context.sourceRef+' ***************');
                break;
            }
        }
        
    }
    execProof(st) {
        this.scope.pushInstanceType('proof');
        this.execute(st.statements);
        this.scope.popInstanceType();
    }
    prepareFunctionCall(func, callinfo) {
        const mapInfo = func.mapArguments(callinfo);
        // console.log(mapInfo);
        // console.log(func.constructor.name);
        // callinfo.dumpArgs(mapInfo.eargs, 'CALLINFO');
        this.callstack.push(mapInfo.scall ?? func.name);
        ++this.functionDeep;
        this.scope.push();
        return mapInfo;
    }
    finishFunctionCall(func) {
        this.scope.pop();
        --this.functionDeep;
        this.callstack.pop();
        if (Debug.active) console.log(`END CALL ${func.name}`, res);
    }
    executeFunctionCall(name, callinfo) {
        const func = this.builtIn[name] ?? this.references.get(name);
        if (Debug.active) {
            console.log(`CALL ${name}`);
            console.log(callinfo);
        }

        if (!func) {
            this.error({}, `Undefined function ${name}`);
        }
        if (func.isBridge) {   
            return func.exec(callinfo);
        }

        const mapInfo = this.prepareFunctionCall(func, callinfo);
        this.references.pushVisibilityScope();
        let res = func.exec(callinfo, mapInfo);
        this.references.popVisibilityScope();
        this.finishFunctionCall(func);
        return (res === false || typeof res === 'undefined') ? new ExpressionItems.IntValue() : res;
    }
    execCall(st) {
        const name = st.function.name;
        if (Debug.active) console.log(`CALL (EXEC) ${name}`);
        const res = this.executeFunctionCall(name, st);
        if (Debug.active) console.log(`END CALL (EXEC) ${name}`);
        return res;
    }
    execAssign(st) {
        // type: number(int), fe, string, col, challenge, public, prover,
        // dimensions:
        // TODO: move to assign class
        const indexes = this.decodeIndexes(st.name.indexes)
        const names = this.context.getNames(st.name.name);
//        if (st.value.type === 'sequence') {
        if (st.value instanceof ExpressionItems.ExpressionList) {
            const sequence = new Sequence(this, st.value, ExpressionItems.IntValue.castTo(this.references.get('N')));
            sequence.extend();
            if (Debug.active) console.log(sequence.size);
            if (Debug.active) console.log(sequence.toString());
            EXIT_HERE;
        }
        if (Debug.active) console.log(st.value);
        const assignedValue = st.value.instance();
        if (st.name.reference) {
            // REVIEW
            EXIT_HERE
            // assert.strictEqual(indexes.length, 0);
            // const assignedValue = st.value.instance();
            if (Debug.active) console.log(assignedValue);
            this.assign.assignReference(names, assignedValue);
            return;
        }
        if (Debug.active) console.log(assignedValue);
        this.assign.assign(names, indexes, assignedValue);
        if (Debug.active) console.log(`ASSIGN ${st.name.name} = ${assignedValue.toString()} \x1B[0;90m[${Context.sourceTag}]\x1B[0m`);
        // this.references.set(st.name.name, [], this.expressions.eval(st.value));
    }
    execHint(s) {
        const name = s.name;
        if (Debug.active) console.log(util.inspect(s.data, false, null, true));
        const res = this.processHintData(s.data);
        if (Debug.active) console.log(util.inspect(res, false, null, true));
        this.hints.define(name, res);
    }
    processHintData(hdata) {
        if (hdata instanceof Expression) {
            const value = hdata.eval();
            if (typeof value === 'bigint') return value;
            return hdata.instance();
        }
        if (hdata.type === 'array') {
            let result = [];
            for (const item of hdata.data) {
                result.push(this.processHintData(item));
            }
            return result;
        }
        if (hdata.type === 'object') {
            let result = {};
            for (const key in hdata.data) {
                // TODO: key no exists
                result[key] = this.processHintData(hdata.data[key]);
            }
            return result;
        }
        if (Debug.active) console.log(hdata);
        EXIT_HERE;
    }
    execIf(s) {
        for (let icond = 0; icond < s.conditions.length; ++icond) {
            const cond = s.conditions[icond];
            if ((icond === 0) !== (cond.type === 'if')) {
                throw new Error('first position must be an if, and if only could be on first position');
            }
            if (cond.type === 'else' && icond !== (s.conditions.length-1)) {
                throw new Error('else only could be on last position');
            }
            if (Debug.active) console.log(cond);

            if (typeof cond.expression !== 'undefined') {
                if (cond.expression.evalAsBool() !== true) {
                    continue;
                }
            }
            this.scope.push();
            const res = this.execute(cond.statements, `IF ${this.sourceRef}`);
            this.scope.pop();
            return res;
        }
    }
    prepareSwitchCase(s) {
        let values = {};
        // s.cases.map((x,i) => {console.log(`#### CASE ${i} ####`); console.log(util.inspect(x.statements, false, 2000, true))});
        for (let index = 0; index < s.cases.length; ++index) {
            const _case = s.cases[index];
            if (_case.condition && _case.condition.values) {
                for (const value of _case.condition.values) {
                    if (value instanceof Expression) {  
                        const _key = value.asInt();
                        if (typeof values[_key] !== 'undefined') {
                            throw new Error(`Switch-case value ${_key} duplicated`);
                        }
                        values[_key] = index;
                    } else if (value.from && value.to && value.from instanceof Expression && value.to instanceof Expression) {
                        const _from = value.from.asInt();
                        const _to = value.to.asInt();
                        if ((_to - _from) < MAX_SWITCH_CASE_RANGE) { 
                            while (_from <= _to) {
                                if (typeof values[_from] !== 'undefined') {
                                    throw new Error(`Switch-case value ${_from} duplicated`);
                                }
                                values[_from] = index;
                                ++_from;
                            }
                        } else {
                            throw new Error(`Switch-case range too big ${from}..${to} (${_to-_from}) max: ${MAX_SWITCH_CASE_RANGE}`);
                        }        
                    } else {
                        console.log(value);
                        EXIT_HERE;
                    }
                }
                _case.__cached_values = values;
            } else if (_case.default) {
                if (typeof values[false] !== 'undefined') {
                    throw new Error(`Switch-case DEFAULT duplicated`);
                }
                values[false] = index;
            } else {
                console.log(_case);
                EXIT_HERE;
            }
        }
        s.__cached_values = values;
    }
    execSwitch(s) {
        // switch must cases value must be constant values
        // TODO: check no constant variable values
        if (!s.__cached_values) {
            this.prepareSwitchCase(s);
        }
        assert.instanceOf(s.value, Expression);
        const value = s.value.asInt();
        let caseIndex = false;
        if (typeof s.__cached_values[value] !== 'undefined') {
            caseIndex = s.__cached_values[value];
        } else if (typeof s.__cached_values[false] !== 'undefined') {
            caseIndex = s.__cached_values[false];
        }
        if (caseIndex !== false) {
            this.scope.push();
            this.execute(s.cases[caseIndex].statements, `SWITCH CASE ${value} ${this.sourceRef}`);
            this.scope.pop();
        }
    }
    execWhile(s) {
        let index = 0;
        let result = false;
        while (true) {
            this.scope.push();
            const whileCond = s.condition.eval().asBool();
            if (!whileCond) {
                this.scope.pop();
                break;
            }
            result = this.execute(s.statements, `WHILE ${this.sourceRef} I:${index}`);
            ++index;
            this.scope.pop();
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
        }
        return result;
    }
    execUse(s) {
        const name = this.expandTemplates(s.name);
        this.references.addUse(name);
    }
    execContainer(s) {
        const name = this.expandTemplates(s.name);
        if (this.references.createContainer(name, s.alias)) {
            const result = this.execute(s.statements, `SCOPE ${this.sourceRef}`);
            this.references.closeContainer();
        }
    }
    // TODO: remove - obsolete
    execScopeDefinition(s) {
        this.scope.push();
        const result = this.execute(s.statements, `SCOPE ${this.sourceRef}`);
        this.scope.pop();
        return result;
    }
    // TODO: remove - obsolete
    execNamedScopeDefinition(s) {
        this.scope.push();
        const result = this.execute(s.statements, `SCOPE ${this.sourceRef}`);
        this.scope.pop();
        return result;
    }
    execFor(s) {
        if (Debug.active) console.log('EXEC-FOR');
        let result;
        this.scope.push();
        this.execute(s.init, `FOR ${this.sourceRef} INIT`);
        let index = 0;
        // while (this.expressions.e2bool(s.condition)) {
        while (true) {
            if (index % 10000 === 0 && index) {
                console.log(`inside FOR ${this.sourceRef} index:${index}`);
            }
            const loopCond = s.condition.eval().asBool();
            if (Debug.active) console.log('FOR.CONDITION', loopCond, s.condition.toString(), s.condition);
            if (!loopCond) break;
            // if only one statement, scope will not create.
            // if more than one statement, means a scope_definition => scope creation
            result = this.execute(s.statements, `FOR ${this.sourceRef} I:${index}`);
            ++index;
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
            if (Debug.active) console.log('INCREMENT', s.increment);
            this.execute(s.increment);
        }
        this.scope.pop();
        return result;
    }
    abortInsideLoop(result) {
        if (result instanceof BreakCmd) {
            // reset FlowAbortCmd because we arrive on loop
            result.reset();
            return true;
        }
        if (result instanceof ReturnCmd) {
            return true;
        }
        return false;
    }
    execForIn(s) {
        if (Debug.active) console.log(s);
        if (s.list && s.list instanceof ExpressionItems.ExpressionList) {
            return this.execForInList(s);
        }
        return this.execForInExpression(s);
    }
    execForInList(s) {
        let result = false;
        this.scope.push();
        this.execute(s.init, `FOR-IN-LIST ${this.sourceRef} INIT`);
        // if (s.init.items[0].reference) {
        //     this.execForInListReferences(s);
        // } else {
        //     this.execForInListValues(s);
        // }
        const reference = s.init.items[0].reference === true;
        const list = new List(this, s.list, reference);
        const name = s.init.items[0].name;
        let index = 0;
        for (const value of list.values) {
            if (reference) {
                this.assign.assignReference(name, value);
            } else {
                this.assign.assign(name, [], value);
            }
            // if only one statement, scope will not create.
            // if more than one statement, means a scope_definition => scope creation
            result = this.execute(s.statements, `FOR-IN-LIST ${this.sourceRef} I:${index}`);
            ++index;
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
        }
        this.scope.pop();
        return result;
    }
    execForInListValues(s) {
        let result = false;
        this.scope.push();
        const list = new List(this, s.list);
        let index = 0;
        for (const value of list.values) {
            // console.log(s.init.items[0]);
            this.assign.assign(s.init.items[0].name, [], value);
            // if only one statement, scope will not create.
            // if more than one statement, means a scope_definition => scope creation
            result = this.execute(s.statements,`FOR-IN-LIST-VALUES ${this.sourceRef} I:${index}`);
            ++index;
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
        }
        this.scope.pop();
        return result;
    }
    execForInListReferences(s) {
        let result = false;
        this.scope.push();
        const name = s.init.items[0].name;
        assert.ok(!s.init.items[0].indexes);
        let index = 0;
        for (const value of s.list) {
            // console.log(s.init.items[0]);
            this.assign.assignReference(name, value);
            // if only one statement, scope will not create.
            // if more than one statement, means a scope_definition => scope creation
            result = this.execute(s.statements,`FOR-IN-LIST-REFERENCES ${this.sourceRef} I:${index}`);
            ++index;
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
        }
        this.scope.pop();
        return result;
    }
    execForInExpression(s) {
        // s.list.expr.dump();
        if (Debug.active) console.log(s);
        if (Debug.active) console.log(s.list);
        let it = new Iterator(s.list);
        this.scope.push();
        this.execute(s.init,`FOR-IN-EXPRESSION ${this.sourceRef} INIT`);
        let result = false;
        let index = 0;
        const isReference = s.init.items[0].reference ?? false;
        const name = s.init.items[0].name;
        for (const value of it) {
            if (isReference) this.assign.assignReference(name, value);
            else {
                let expr = new Expression();
                expr._set(value);
                this.assign.assign(name, [], expr);
            }
            result = this.execute(s.statements,`FOR-IN-EXPRESSION ${this.sourceRef} I:${index}`);
            ++index;
            if (this.abortInsideLoop(result)) {
                result = result.getResult();
                break;
            }
        }
        this.scope.pop();
        return result;

        // this.decodeArrayReference(s.list);
        // [ref, indexs, length] = this.references.getArrayReference(s.list.expr)
        //
    }
    decodeArrayReference(slist) {
        // slist.expr.dump();
        const [name, indexes, legth] = slist.getRuntimeReference();
    }
    execBreak(s) {
        return new BreakCmd();
    }
    execContinue(s) {
        return new ContinueCmd();
    }
    error(s, msg) {
        console.log(s);
        throw new Error(msg);
    }
    execInclude(s) {
        if (!s.contents) {
            // to support dynamic includes, add some internal statements need to compile inside subproof
            // but after take compiled statements. TODO: analyze use current subproof name
            const sts = this.compiler.loadInclude(s.file.asString(), {preSrc: 'subproof __(2**2) {\n', postSrc: '\n};\n'});
            if (sts === false) {
                throw new Error(`ERROR loading include ${s.file.asString()}`);
            }
            s.contents = sts[0].statements;
        }
        return this.execute(s.contents);
    }
    execRequire(s) {
        const requireId = s.file.asString();
        if (!s.contents) {
            // TODO: check if sense use dynamic requires
            const sts = this.compiler.loadInclude(requireId, {preSrc: 'subproof __(2**2) {\n', postSrc: '\n};\n'});
            if (sts === false) {
                return;
            }
            s.contents = sts[0].statements;
        }

        // require is "executed" once to avoid redefinitions
        if (!this.loadedRequire[requireId]) {
            this.loadedRequire[requireId] = true;
            return this.execute(s.contents);
        }    
    }
    execFunctionDefinition(s) {
        if (Debug.active) console.log('FUNCTION '+s.name);
        const id = this.references.declare(s.name, 'function', [], {sourceRef: Context.sourceRef});
        let func = new Function(id, s);
        this.references.set(func.name, [], func);
    }
    getExprNumber(expr, s, title) {
        if (Debug.active) {
            console.log(s);
            expr.dump();
        }
        const se = ExpressionItems.IntValue.castTo(expr.eval());
        if (typeof se !== 'bigint') {
//        if (se.op !== 'number') {
            console.log('ERROR');
            console.log(se);
            this.error(s, title + ' is not constant expression (1)');
        }
//        return Number(se.value);
        return se;
    }
    resolveExpr(expr, s, title) {
        return this.expressions.eval(expr);
    }
    execNamespace(s) {
        const subproof = s.subproof ?? false;
        const namespace = s.namespace;
        if (subproof !== false && !this.subproofs.isDefined(subproof)) {
            this.error(s, `subproof ${s.subproof} hasn't been defined`);
        }

        // TODO: verify if namespace just was declared in this case subproof must be the same
        this.context.push(namespace, subproof);
        this.scope.push();
        this.execute(s.statements, `NAMESPACE ${namespace}`);
        this.scope.pop(['witness', 'fixed', 'im']);
        this.context.pop();
    }
    evalExpressionList(e) {
        assert.strictEqual(e.type, 'expression_list');
        let values = [];
        for (const value of e.values) {
            values.push(value.evalAsInt());
        }
        return values;
    }
    log2_32bits(value) {
            return (  (( value & 0xFFFF0000 ) !== 0 ? ( value &= 0xFFFF0000, 16 ) :0 )
                    | (( value & 0xFF00FF00 ) !== 0 ? ( value &= 0xFF00FF00, 8  ) :0 )
                    | (( value & 0xF0F0F0F0 ) !== 0 ? ( value &= 0xF0F0F0F0, 4  ) :0 )
                    | (( value & 0xCCCCCCCC ) !== 0 ? ( value &= 0xCCCCCCCC, 2  ) :0 )
                    | (( value & 0xAAAAAAAA ) !== 0 ? 1: 0 ) );
    }
    log2(value) {
        let base = 0;
        value = BigInt(value);
        while (value > 0xFFFFFFFFn) {
            base += 32;
            value = value >> 32n;
        }

        return base + this.log2_32bits(Number(value));
    }
    checkRows(rows) {
        if (2n ** BigInt(this.log2(rows)) !== BigInt(rows)) {
            throw new Error(`Invalid N ${rows}. N must be a power of 2`);
        }
    }
    execSubproofDefinition(s) {
        const subproofName = s.name ?? false;
        if (subproofName === false) {
            this.error(s, `subproof not defined correctly`);
        }

        const subproof = new Subproof(subproofName, s.statements, s.aggregate ?? false);
        this.subproofs.define(subproofName, subproof, `subproof ${subproofName} has been defined previously on ${this.context.sourceRef}`);

        const id = this.references.declare(subproofName, 'function', [], {sourceRef: Context.sourceRef});
        const subproofFunc = new SubproofFunction(id, {args: s.args, name: subproofName, subproof, sourceRef: Context.sourceRef});
        this.references.set(subproofName, [], subproofFunc);
    }
    execSubproofBlock(s) {
        const subproofName = s.name ?? false;
        if (subproofName === false) {
            this.error(s, `subproof not defined correctly`);
        }
        const subproof = this.subproofs.get(subproofName);
        if (!subproof) {
            throw new Error(`Subproof definition ${subproofName} hasn't been defined before subproof block`);
        }
        subproof.addBlock(s.statements);
    }
    /**
     * method to return id of subproof, if this id not defined yet, use lastSubproofId to set it
     * @param {Subproof} subproof 
     * @returns {number}
     */
    getSubproofId(subproof) {    
        const subproofId = subproof.getId();
        if (subproofId !== false) {
            this.proto.useSubproof(subproofId);
            return subproofId;
        }
        ++this.lastSubproofId;
        subproof.setId(this.lastSubproofId);
        this.proto.setSubproof(this.lastSubproofId, subproof.name, subproof.aggregate);
        return this.lastSubproofId;
    }
    /**
     * Open or reopen a subproof with name subproofName, this means that 
     * start to executing inside subproof scope
     * @param {string} subproofName 
     * @param {Subproof} subproof 
     */
    openSubproof(subproof) {
        this.currentSubproof = subproof;
        this.scope.pushInstanceType('subproof');
        this.context.subproofName = subproof.name;
        this.subproofId = this.getSubproofId(subproof);        
        Context.subproofId = this.subproofId;
    }    
    /**
    * close current subproof and call defered funcions, clear scope of subproof
    */
    closeCurrentSubproof() {
        this.suspendCurrentSubproof();
        this.references.clearScope('subproof');
        this.finalSubproofScope();
        if (this.proto) this.proto.setSubproofValues(this.subproofvalues.getAggreationTypesBySubproofId(this.subproofId));
    }
    /**
    * "suspend" current because this subproof could be opened again
    */
    suspendCurrentSubproof() {
        this.scope.popInstanceType();
        this.currentSubproof = false;
        this.subproofId = false;
        Context.subproofId = false;
    }
    /**
    * create a new air on current subproof, take number of rows of N parameter of subproof
    * if this parameter doesn't exists an error was produced
    */
    createAir(subproof) {
        const item = this.references.isDefined('N') ? this.references.getItem('N') : false;
        if (!(item instanceof ExpressionItems.IntValue)) {
            throw new Error(`an int parameter N must be declared as subproof argument`);
        }
        const rows = item.asInt();
        this.checkRows(rows);
        this.rows = rows;

        const air = subproof.createAir(this.rows);
        if (this.proto) this.proto.setAir(air.id, air.name, this.rows);
        Context.airId = air.id
        Context.airName = air.name;
        return air;
    }
    closeAir() {
        console.log(`END AIR ${Context.airName} (${this.rows}) #${Context.airId}`);
        Context.airId = false;
        Context.airName = false;
    }
    setBuiltIntConstants(subproof, air) {
        // create built-in constants
        this.references.set('BITS', [], air.bits);
        this.references.set('SUBPROOF', [], subproof.name);  
        this.references.set('SUBPROOF_ID', [], new ExpressionItems.IntValue(subproof.id));  
        this.references.set('AIR_ID', [], new ExpressionItems.IntValue(air.id));  
    }
    executeSubproof(subproof, subproofFunc, callinfo) {
        // proto.setSubproofvalues(this.subproofvalues.getPropertyValues(['id', 'aggregateType', 'subproofId']));
        // console.log(callinfo);
        this.openSubproof(subproof);

        // subproof was a function derivated class
        const mapinfo = this.prepareFunctionCall(subproofFunc, callinfo);
        subproofFunc.prepare(callinfo, mapinfo);

        const air = this.createAir(subproof);

        this.setBuiltIntConstants(subproof, air);
        this.context.push(false, subproof.name);
        this.scope.pushInstanceType('air');
        subproof.airStart();
        let res = subproof.exec(air.name ,callinfo);
        this.finalAirScope();
        subproof.airEnd();

        if (this.proto) this.subproofProtoOut(subproof.id, air.id)

        this.constraints = new Constraints();

        this.clearAirScope(air.name);
        this.scope.popInstanceType(['witness', 'fixed', 'im']);
        this.context.pop();
        this.closeAir(air);

        // closing subproof but no closing final        
        this.suspendCurrentSubproof(false);

        this.finishFunctionCall(subproof);

        return (res === false || typeof res === 'undefined') ? new ExpressionItems.IntValue() : res;
    }
    finalClosingSubproofs() {
       for (const subproof of this.subproofs.values()) {
            if (subproof.id === false) continue;
            this.openSubproof(subproof);
            this.closeCurrentSubproof();
        }
    }
    subproofProtoOut(subproofId, airId) {
        if (Context.config.protoOut === false) return;
        
        let packed = new PackedExpressions();
        this.proto.setFixedCols(this.fixeds);
        this.proto.setPeriodicCols(this.fixeds);
        this.proto.setWitnessCols(this.witness);
        // this.expressions.pack(packed, {instances: [air.fixeds, air.witness]});
        this.expressions.pack(packed, {instances: [this.fixeds, this.witness]});
        this.proto.setConstraints(this.constraints, packed,
            {
                labelsByType: {
                    witness: this.witness.labelRanges,
                    fixed: this.fixeds.labelRanges,
                    subproofvalue: (id, options) => this.subproofvalues.getRelativeLabel(subproofId, id, options)
                },
                expressions: this.expressions
            });
        const info = {airId, subproofId};
        this.proto.setSymbolsFromLabels(this.witness.labelRanges, 'witness', info);
        this.proto.setSymbolsFromLabels(this.fixeds.labelRanges, 'fixed', info);
        this.proto.addHints(this.hints, packed, {
                subproofId,
                airId
            });
        this.proto.setExpressions(packed);
    }
    finalAirScope() {
        this.callDelayedFunctions('air', 'final');
    }
    clearAirScope(label = '') {
        this.references.clearType('fixed', label);
        this.references.clearType('witness', label);
        this.references.clearScope('air');
        this.expressions.clear(label);
        this.hints.clear();
    }
    finalSubproofScope() {
        this.callDelayedFunctions('subproof', 'final');
    }
    finalProofScope() {
        this.callDelayedFunctions('proof', 'final');
    }
    callDelayedFunctions(scope, event) {
        if (Debug.active) console.log(this.delayedCalls);
        if (typeof this.delayedCalls[scope] === 'undefined' || typeof this.delayedCalls[scope][event] === 'undefined') {
            return false;
        }
        for (const fname in this.delayedCalls[scope][event]) {
            if (Debug.active) console.log(`CALL DELAYED(${scope},${event}) FUNCTION ${fname}`);
            this.execCall({ op: 'call', function: {name: fname}, args: [] });
        }
        this.delayedCalls[scope][event] = {};
    }
    execWitnessColDeclaration(s) {
        this.colDeclaration(s, 'witness', false, true, {stage: s.stage ? Number(s.stage):0 });
    }
    execFixedColDeclaration(s) {
        const global = s.global ?? false;
        for (const col of s.items) {
            const colname = this.context.getFullName(col.name);
            // console.log(`COL_FIXED_DECLARATION(${colname})`);
            const lengths = this.decodeLengths(col);
            let init = s.sequence ?? null;
            let seq = null;
            if (init) {
                seq = new Sequence(this, init, ExpressionItems.IntValue.castTo(this.references.get('N')));
                if (Context.config.fixed !== false) seq.extend();
            } else if (s.init) {
                seq = s.init.instance();
                if (seq.dump) seq.dump();
                else console.log(seq);
            }
            console.log(this.declareFullReference(colname, 'fixed', lengths, {global}, seq));
        }
    }
    execDebugger(s) {
        debugger;
    }
    execColDeclaration(s) {
        // intermediate column
        const global = s.global ?? false;
        for (const col of s.items) {
            const lengths = this.decodeLengths(col);
            const id = this.declareFullReference(col.name, col.reference ? '&im' : 'im', lengths, {global});

            let init = s.init;
            if (!init || !init || typeof init.instance !== 'function') {
                continue;
            }
            if (col.reference) {
                this.references.setReference(col.name, s.init.instance());
            } else {
                init = init.instance();
                this.expressions.set(id, init);
            }
        }
    }
    execPublicDeclaration(s) {
        this.colDeclaration(s, 'public', true, false);
        // TODO: initialization
        // TODO: verification defined
    }
    execProofValueDeclaration(s) {
        this.colDeclaration(s, 'proofvalue', true, false);
        // TODO: initialization
        // TODO: verification defined
    }
    execSubproofValueDeclaration(s) {
        const name = s.items[0].name ?? '';

        if (this.currentSubproof === false) {
            throw new Error(`Subproofvalue ${name} must be declared inside subproof (air)`);
        }
        for (const value of s.items) {
            const lengths = this.decodeLengths(value);
            const res = this.currentSubproof.declareSubproofvalue(value.name, lengths, {aggregateType: s.aggregateType, subproofId: this.subproofId, sourceRef: this.sourceRef});
        }
    }
    execChallengeDeclaration(s) {
        this.colDeclaration(s, 'challenge', true, false, {stage: s.stage ? Number(s.stage):0});
        // TODO: initialization
        // TODO: verification defined
    }
    execDelayedFunctionCall(s) {
        const scope = s.scope;
        const fname = s.function.name;
        const event = s.event;
        if (s.args.length > 0) {
            throw new Error('delayed function call arguments are not yet supported');
        }
        if (event !== 'final') {
            throw new Error(`delayed function call event ${event} no supported`);
        }
        if (['proof', 'subproof', 'air'].includes(scope) === false) {
            throw new Error(`delayed function call scope ${scope} no supported`);
        }
        if (typeof this.delayedCalls[scope] === 'undefined') {
            this.delayedCalls[scope] = {};
        }
        if (typeof this.delayedCalls[scope][event] === 'undefined') {
            this.delayedCalls[scope][event] = {};
        }
        if (typeof this.delayedCalls[scope][event][fname] === 'undefined') {
            this.delayedCalls[scope][event][fname] = {sourceRefs: []};
        }
        this.delayedCalls[scope][event][fname].sourceRefs.push(this.context.sourceRef);
    }
    execExpr(s) {
        s.expr.eval();
        // this.expressions.eval(s.expr);
    }
    decodeNameAndLengths(s) {
        return [s.name, this.decodeLengths(s)];
    }
    decodeIndexes(indexes) {
        let values = [];
        if (indexes) {
            for (const index of indexes) {
                values.push(Number(index.evalAsInt()));
            }
        }
        return values;
    }
    decodeLengths(s) {
        return this.decodeIndexes(s.lengths);
    }
    colDeclaration(s, type, ignoreInit, fullName = true, data = {}) {
        for (const col of s.items) {
            const lengths = this.decodeLengths(col);
            let init = s.init;
            if (init && init && typeof init.instance === 'function') {
                init = init.instance();
            }
            if (fullName) this.declareFullReference(col.name, type, lengths, data, ignoreInit ? null : init);
            else this.declareReference(col.name, type, lengths, data, ignoreInit ? null : init);
            /// TODO: INIT / SEQUENCE
        }
    }
    declareFullReference(name, type, lengths = [], data = {}, initValue = null) {
        const _name = this.context.getFullName(name);
        return this.declareReference(_name, type, lengths, data, initValue);
    }
    declareReference(name, type, lengths = [], data = {}, initValue = null) {
        if (!data.sourceRef) {
            data.sourceRef = this.sourceRef;
        }
        const res = this.references.declare(name, type, lengths, data);
        if (initValue !== null) {
            this.references.set(name, [], initValue);
        }
        return res;
    }
    execCode(s) {
        return this.execute(s.statements,`CODE ${this.sourceRef}`);
    }
    execConstraint(s) {
        const scopeType = this.scope.getInstanceType();
        let id, expr, prefix = '';

        assert.instanceOf(s.left, Expression);
        assert.instanceOf(s.right, Expression);
        if (Debug.active) s.left.dump('LEFT-CONSTRAINT 1');
        // s.right.dump('RIGHT-CONSTRAINT 1');
        const left = s.left.instance();
        // const right = s.right.instance();
        if (Debug.active) left.dump('LEFT-CONSTRAINT 2');
        // right.dump('RIGHT-CONSTRAINT 2');
        const _left = s.left.instance({simplify: true})
        const _right = s.right.instance({simplify: true});
        if (Debug.active) _left.dump('LEFT-CONSTRAINT 3');
        if (Debug.active) _right.dump('RIGHT-CONSTRAINT 3');
        if (scopeType === 'air') {
            id = this.constraints.define(_left, _right,false,this.sourceRef);
            expr = this.constraints.getExpr(id);
        } else if (scopeType === 'proof') {
            id = this.globalConstraints.define(s.left.instance({simplify: true}), s.right.instance({simplify: true}),false,this.sourceRef);
            expr = this.globalConstraints.getExpr(id);
            prefix = 'GLOBAL';
        } else {
            throw new Error(`Constraint definition on invalid scope (${scopeType}) ${this.context.sourceRef}`);
        }
        console.log(`\x1B[1;36;44m${prefix}CONSTRAINT [${Context.proofLevel}] > ${expr.toString({hideClass:true, hideLabel:false})} === 0 (${this.sourceRef})\x1B[0m`);
        console.log(`\x1B[1;36;44m${prefix}CONSTRAINT [${Context.proofLevel}] (RAW) > ${expr.toString({hideClass:true, hideLabel:true})} === 0 (${this.sourceRef})\x1B[0m`);
    }
    execVariableIncrement(s) {
        // REVIEW used only inside loop (increment) in other cases was an expression
        const name = s.name;
        const value = this.references.get(name, []);
        // REVIEW: could be an expression (if expression x+1+1 = x+2)
        const intValue = value.getValue();
        if (Debug.active) console.log(`INCREMENT ${s.name} = ${intValue} + ${s.pre + s.post} = ${intValue + s.pre + s.post}`);
        // console.log(s.pre, s.post, value.getValue());
        this.references.set(name, [], intValue + s.pre + s.post);
    }
    execVariableDeclaration(s) {
        if (Debug.active) console.log('VARIABLE DECLARATION '+Context.sourceRef+' init:'+s.init);
        const initialization = typeof s.init !== 'undefined';
        const count = s.items.length;

        if (s.multiple && s.init.length !== count) {
            this.error(s, `Mismatch between len of variables (${count}) and len of their inits (${inits.length})`);
        }

        for (let index = 0; index < count; ++index) {
            const [name, lengths] = this.decodeNameAndLengths(s.items[index]);
            const sourceRef = s.debug ?? this.sourceRef;
            const scope = s.scope ?? false;
            let initValue = null;
            if (initialization) {
                const init = s.multiple ? s.init.getItem([index]) : s.init;
                if (init instanceof ExpressionItems.ExpressionList) {
                    initValue = init.eval();
                } else {
                    if (Debug.active) console.log(name, s.vtype, Context.sourceRef);
                    switch (s.vtype) {
                        case 'expr':
                            initValue = init.eval();
                            break;
                        case 'int':
                            initValue = init.eval().asIntItem();
                            break;
                        case 'string':
                            initValue = init.eval().asStringItem();;
                            break;
                    }
                    if (Debug.active) console.log(name, s.vtype, initValue.toString ? initValue.toString() : initValue);
                }
            }
            this.references.declare(name, s.vtype, lengths, { scope, sourceRef, const: s.const ?? false }, initValue);
            if (initValue !== null) {
                const initValueText = typeof initValue.toString === 'function' ? initValue.toString() : initValue;
                if (Debug.active) console.log(`ASSIGN(DECL) ${name} = ${initValueText} \x1B[0;90m[${Context.sourceTag}]\x1B[0m`);
                // this.references.set(name, [], initValue);
            }
        }
    }
    execConstantDefinition(s) {
        if (s.sequence) {
            const lengths = this.decodeLengths(s);
            this.references.declare(s.name, 'constant', lengths, { sourceRef: this.sourceRef });
            const def = this.references.getDefinition(s.name);
            // TODO: SEQUENCE_ARRAY_LENGTHS
            const seq = new Sequence(this, s.sequence);
            const asize = def.array.getSize();
            const ssize = seq.size;
            if (ssize !== asize) {
                throw new Error(`Array size mismatch on initialization ${asize} vs ${ssize}`);
            }
            // TODO, check sizes before extends
            seq.extend();
            const seqSize = seq.getSize();
            for (let index = 0; index < seqSize; ++index) {
                this.references.set(s.name, def.array.offsetToIndexes(index), seq.getValue(index));
            }
        } else {
            this.references.declare(s.name, 'constant', [], { sourceRef: this.sourceRef });
            const value = this.getExprNumber(s.value, s, `constant ${s.name} definition`);
            this.references.set(s.name, [], value);
        }
    }
    expandTemplates(text) {
        if (!text.includes('${')) {
            return text;
        }
        return this.evaluateTemplate(text);
    }

    evaluateTemplate(template) {
        const regex = /\${[^}]*}/gm;
        let m;
        let tags = [];
        let lindex = 0;
        while ((m = regex.exec(template)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            tags.push({pre: m.input.substring(lindex, m.index), expr: m[0].substring(2,m[0].length-1)});
            lindex = m.index + m[0].length;
        }
        const lastS = template.substring(lindex);

        // create a tag for each substitution string
        const codeTags = tags.map((x, index) => 'expr ____'+index+' = '+x.expr+";").join("\n");

        // compile a list of tags to created its associated expressions
        // this expressions aren't executed, only compiled for this reason
        // we don't need create a context.
        const compiledTags = this.compiler.parseExpression(codeTags);

        // evaluating different init of each tag
        const stringTags = compiledTags.map(e => e.init.eval({unroll: true}).toString());

        // replace on string each tag for its value
        const evaluatedTemplate = stringTags.map((s, index) => tags[index].pre + s).join('')+lastS;
        if (Debug.active) console.log(`TEMPLATE "${template}" ==> "${evaluatedTemplate}"`);
        return evaluatedTemplate;
    }
    evaluateExpression(e){
        // TODO
        TODO_STOP
        return 0n;
    }
    execReturn(s) {
        const sourceRef = this.sourceRef;
        this.traceLog(`[RETURN.BEGIN ${sourceRef}] ${this.scope.deep}`);
        if (!this.insideFunction()) {
            throw new Error('Return is called out of function scope');
        }
        const res = s.value.instance();
        if (Debug.active) {
            console.log(res);
            console.log(res.eval());
        }
        this.traceLog(`[RETURN.END  ${sourceRef}] ${this.scope.deep}`);
        return new ReturnCmd(res);
    }
    e2value(e, s, title) {
        return e.evalAsValue();
    }
}
