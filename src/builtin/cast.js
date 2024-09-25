const Function = require("../function.js");
const Context = require('../context.js');
const Expression = require('../expression.js');
const ExpressionItems = require('../expression_items.js');

module.exports = class Cast extends Function {
    constructor (parent) {
        super(parent, {name: 'cast'});
    }
    exec(s, mapInfo) {
        const cast = typeof mapInfo.eargs[0].asString === 'function' ? mapInfo.eargs[0].asString() : mapInfo.eargs[0];
        if (cast !== 'string') {
            throw new Error('Invalid type of cast');
        }
        return new ExpressionItems.StringValue(mapInfo.eargs[1].toString({hideClass:true, hideLabel:false}));
    }
}
