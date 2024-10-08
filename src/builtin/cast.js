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
        const value = mapInfo.eargs[1];
        if (Array.isArray(value)) {
            return new ExpressionItems.StringValue(value.map(x => x.toString({hideClass:true, hideLabel:false})).join(','));
        }
        return new ExpressionItems.StringValue(value.toString({hideClass:true, hideLabel:false}));
    }
}
