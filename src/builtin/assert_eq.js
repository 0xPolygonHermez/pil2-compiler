const Function = require("../function.js");
const Expression = require('../expression.js');
const Context = require('../context.js');
const IntValue = require('../expression_items/int_value.js');
const assert = require('../assert.js');
module.exports = class AssertEq extends Function {
    constructor () {
        super(999999, {name: 'assert_eq'});
    }
    mapArguments(s) {
        if (s.args.length < 2 || s.args.length > 3) {
            throw new Error('Invalid number of parameters');
        }
        assert.instanceOf(s.args[0], Expression);
        assert.instanceOf(s.args[1], Expression);
        const arg0 = s.args[0].eval();
        const arg1 = s.args[1].eval();
        if (!arg0.equals(arg1)) {
            const msg = s.args[2] ? s.args[2].toString() + '\n' : '';
            throw new Error(msg + `Assert fails (${arg0} === ${arg1}) on ${Context.sourceRef}`);
        }
        return 0n;
    }
    exec(s, mapInfo) {
        return new IntValue(mapInfo);
    }
}
