const Generic = require('./generic.js');
module.exports = class ExpressionItem extends Generic {
    constructor (message, expressionItem, extra = {}) {
        super(message, extra);
    }
}