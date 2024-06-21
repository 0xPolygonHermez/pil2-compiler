const Context = require('../context.js');
const Generic = require('./generic.js');
module.exports = class Statement extends Generic {
    constructor (message, statement, extra = {}) {
        super(`\x1B31m[${Context.sourceRef}] ${message}`);
    }
}