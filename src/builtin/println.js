const Function = require("../function.js");
const IntValue = require('../expression_items/int_value.js');
module.exports = class Println extends Function {
    constructor (parent) {
        super(parent, {name: 'println', args: [], returns: [] });
        this.nargs = false;
    }
    exec(s, mapInfo) {
        console.log(`\x1B[36m  > ${mapInfo.eargs.join(' ')}\x1B[0m`);
        return new IntValue(0);
    }
}
