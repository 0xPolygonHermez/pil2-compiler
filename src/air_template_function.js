const util = require('util');
const {FlowAbortCmd, BreakCmd, ContinueCmd, ReturnCmd} = require("./flow_cmd.js");
const Expression = require("./expression.js");
const ExpressionItems = require("./expression_items.js");
const Function = require("./function.js");
const Context = require('./context.js');
const Debug = require('./debug.js');

module.exports = class AirTemplateFunction extends Function {
    constructor (id, data = {}) {
        super(id, data);
        this.airTemplate = data.instance;
        this.isBridge = true;
        this.isVirtualizable = false;
        this.inlineRows = false;
    }
    prepare(callInfo, mapInfo) {
        this.declareAndInitializeArguments(mapInfo.eargs);
    }
    /**
     * arguments of an inline instance, N isn't one of them: it's inherited from the air that
     * instances it, the template couldn't change the number of rows of the air it expands on.
     */
    prepareInline(callInfo, mapInfo, rows) {
        this.checkInlineRows(mapInfo, rows);
        this.inlineRows = rows;
        try {
            this.declareAndInitializeArguments(mapInfo.eargs);
        } finally {
            this.inlineRows = false;
        }
    }
    /**
     * N of an inline instance is inherited, but when the call passes it explicitly it must
     * be exactly the N of the air that instances it.
     */
    checkInlineRows(mapInfo, rows) {
        const index = Object.keys(this.args ?? {}).indexOf('N');
        if (index < 0) return;
        const value = (mapInfo.eargs ?? [])[index];
        if (typeof value === 'undefined') return;
        const N = Number(ExpressionItems.IntValue.castTo(value));
        if (N === Number(rows)) return;
        throw new Error(`N of the inline instance ${this.name} is ${N}, but the air that instances it has ` +
                        `${rows} rows, they must match at ${Context.sourceRef}`);
    }

    exec(callInfo, mapInfo = {}, options = {}) {
        if (options.inline) {
            return Context.processor.executeInlineAirTemplate(this.airTemplate, this, callInfo, options);
        }
        const res = Context.processor.executeAirTemplate(this.airTemplate, this, callInfo, options);
        return res === false ? new ExpressionItems.IntValue(0) : res;
    }    
    declareArgument(name, type, lengths, options, value) {
        if (name !== 'N') {
            return super.declareArgument(name, type, lengths, options, value);
        }
        // N of an inline instance is inherited from the air that instances it
        if (this.inlineRows !== false) return;
        Context.references.set('N', [], value);
    }
    toString() {
        return `[airgroup(func) ${this.name}${this.args ? '(' + Object.keys(this.args).join(',') + ')': ''}]`;
    }
}
