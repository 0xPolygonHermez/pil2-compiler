const util = require('util');
const {cloneDeep} = require('lodash');
const {FlowAbortCmd, BreakCmd, ContinueCmd, ReturnCmd} = require("./flow_cmd.js");
const Expression = require("./expression.js");
const ExpressionItems = require("./expression_items.js");
const List = require("./list.js");
const Context = require('./context.js');
const Debug = require('./debug.js');
const Types = require('./types.js');
const {ArrayOf} = require('./expression_items.js')
module.exports = class Function {
    constructor (id, data = {}) {
        this.id = id;
        this.initialized = [data.args, data.returns, data.statements, data.name].some(x => typeof x !== 'undefined');
        this.name = data.name;
        this.nargs = 0;
        if (data.args) {
            this.defineArguments(data.args);
        }
        this.returns = data.returns ?? []
        this.statements = data.statements ?? [];
        this.sourceRef = data.sourceRef;
    }
    setValue(value) {
        if (Debug.active) {
            console.log(`FUNCTION.setValue ${value.name}`, value.args);
        }
        if (this.initialized) {
            throw new Error(`function it's initialized again`);
        }
        if (value instanceof Function === false) {
            throw new Error(`Invalid value to setValue of function`);
        }
        this.initialized = value.initialized;
        this.name = value.name;
        // TODO: clone return types
        this.args = {...value.args};
        if (Debug.active) {
            console.log(`FUNCTION.setValue2 ${value.name}`, this.args);
        }
        this.returns = value.returns && Array.isArray(value.returns) ? [...value.returns] : value.returns;
        this.statements = value.statements;
    }
    defineArguments(args) {        
        this.args = {};
        for (const arg of args) {
            const name = arg.name;
            ++this.nargs;
            if (name === '') throw new Error('Invalid argument name');
            if (name in this.args) throw new Error(`Duplicated argument ${name}`);

            this.args[name] = {type: arg.type, dim: arg.dim, defaultValue: arg.defaultValue};
        }
    }
    checkNumberOfArguments(args) {
        if (this.nargs === false) return;
        const argslen = args.length ?? 0;
        if (argslen < this.nargs) {
            throw new Error(`Invalid number of arguments calling ${this.name} function, called with ${argslen} arguments, but defined with ${this.nargs} arguments at ${Context.sourceRef}`);
        }
    }
    // instance all called arguments on call scope before
    // scope changes. Instance, not evaluate because arguments become from compiler
    instanceArguments(args) {
        let eargs = [];
        let argslen = args.length ?? 0;
        let argnames = Object.keys(this.args);
        this.checkNumberOfArguments(args);
        for (let iarg = 0; iarg < argslen; ++iarg) {
            const argname = argnames[iarg] ?? 'undef';
            if (Debug.active) {
                console.log(`FUNC.instanceArguments ${this.name}.args[${iarg}](${argname})`, this.args[argname]);
            }
            const arg = args[iarg];
            const value = arg.instance({unroll: true});
            eargs.push(value);
        }
        if (Debug.active) {
            console.log('ARGUMENTS '+eargs.map(x => x.toString()).join(','));
        }
        return eargs;
    }
    // mapArgument was called before enter on function visibility scope because
    // inside function args "values" aren't visible.
    mapArguments(s) {
        if (Debug.active) console.log(s.args);
        const eargs = this.instanceArguments(s.args);
        if (Debug.active) console.log(eargs);
        const scall = this.callToString(eargs);
        if (Debug.active) {
            console.log(`FUNCTION.mapArguments(s.args) ${this.name}`);
            console.log(util.inspect(s.args, false, null, true));
            console.log(`FUNCTION.mapArguments ${this.name}`);
            console.log(util.inspect(eargs, false, null, true));
        }
        this.checkArgumentsTypes(eargs);
        return {eargs, scall};
    }
    // calculate a string to debug, with function name and list of arguments
    // with its values
    callToString(eargs) {
        let iarg = 0;
        let textArgs = [];
        for (const name in this.args) {
            textArgs.push(name + ((eargs[iarg] && typeof eargs[iarg].toString === 'function') ? ': ' + eargs[iarg].toString():''));
            ++iarg;
        }
        return this.name + '(' + textArgs.join(', ') + ')';
    }

    // to check arguments used in call, checks if its types and dimensions match with
    // the arguments defined on function
    checkArgumentsTypes(args) {
        let iarg = 0;
        for (const name in this.args) {
            // TODO: checking types and dims
            /*
            if (Array.isArray(args[iarg])) {
                for (const arg of args[iarg]) {
                    arg.dump();
                }
            } else {
                args[iarg].dump();
            }*/
            ++iarg;
        }
    }
    declareAndInitializeArguments(eargs) {
        Context.processor.sourceRef = this.sourceRef;
        let iarg = 0;
        for (const name in this.args) {
            if (typeof eargs[iarg] === 'undefined') {
                this.setDefaultArgument(name);
            } else {
                this.setArgument(name, eargs[iarg]);
            }
            ++iarg;
        }
    }
    setDefaultArgument(name) {
        this.setArgument(name, this.args[name].defaultValue);
    }
    setArgument(name, value) {
        const arg = this.args[name];
        if (Debug.active) {
            console.log(name);
            console.log(arg);
            console.log(value.dim);
            let values = Array.isArray(value) ? value : [value];
            for (const v of values) {
                if (typeof v.dump === 'function') v.dump(`${this.name}(...${name}...) ${Context.sourceRef}`);
                else console.log(v);
            }
        }

        if (value instanceof Expression && value.isAlone()) {
            value = value.getAloneOperand();
        }
        let lengths = [];
        if (value.array) {            
            lengths = value.array.lengths;
        } else if (Array.isArray(value)) {
            lengths = [value.length];
        }

        // REVIEW: use arg.type, but perphaps we need to do a casting
        if (lengths.length !== arg.dim) {        
            console.log(arg);
            console.log(value.dim);
            throw new Error(`Invalid match dimensions on call ${this.name} and parameter ${name} (${lengths.length} !== ${arg.dim})`);
        }
        Context.references.declare(name, arg.type, lengths, {sourceRef: this.sourceRef}, value);
        return false;
    }
    exec(callInfo, mapInfo) {
        this.declareAndInitializeArguments(mapInfo.eargs);
        if (Debug.active) console.log(Context.constructor.name);
        let res = Context.processor.execute(this.statements, `FUNCTION ${this.name}`);
        if (res instanceof ReturnCmd) {
            Context.processor.traceLog('[TRACE-BROKE-RETURN]', '38;5;75;48;5;16');
            return res.reset();
        }
        return res;
    }
    toString() {
        return `[Function ${this.name}${this.args ? '(' + Object.keys(this.args).join(',') + ')': ''}]`;
    }
}
