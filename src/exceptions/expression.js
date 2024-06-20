const Generic = require('./generic.js');
module.exports = class Expression extends Generic {
    constructor (message, expression, extra = {}) {
        super(message, extra);
    }
}