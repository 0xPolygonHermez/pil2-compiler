const Context = require('./context.js');
module.exports = class Generic extends Error {
    constructor (message, extra = {}) {
        super(`\x1B31m[${Context.sourceRef}] ${message}`);
    }
}