const Air = require("./air.js")
const Context = require('./context.js');
const {FlowAbortCmd, BreakCmd, ContinueCmd, ReturnCmd} = require("./flow_cmd.js");
const ExpressionItems = require('./expression_items.js');
module.exports = class AirTemplate {
    constructor (name, statements) {
        this.name = name;
        this.blocks = [statements];
        this.instances = [];
    }
    addBlock(statements) {
        this.statements = [...this.statements, ...statements];
    }
    instance(id, airGroup, rows, options = {}) {
        const air = new Air(id, airGroup, this, rows, options);
        this.instances.push(air);
        return air;
    }
    exec(callInfo, mapInfo, options = {}) {
        let res = false;
        for (const statements of this.blocks) {
            console.log(`AIR ${Context.airName} #${Context.airId} TEMPLATE ${this.name}`);
            res = Context.processor.execute(statements, `AIR ${Context.airName} #${Context.airId} TEMPLATE ${this.name}`);
            if (res instanceof FlowAbortCmd) {
                assert.instanceOf(res, ReturnCmd);
                Context.processor.traceLog('[TRACE-BROKE-RETURN]', '38;5;75;48;5;16');
                res = res.reset();
            }
        }
        return (res === false || typeof res === 'undefined') ? new ExpressionItems.IntValue(0) : res;
    }   
}
