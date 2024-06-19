const Generic = require('./generic.js');
module.exports = class Internal extends Generic {
    constructor (message, extra = {}) {
        super(message, extra);
    }
}