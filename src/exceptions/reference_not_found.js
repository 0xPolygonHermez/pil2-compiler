const Generic = require('./generic.js');
module.exports = class ReferenceNotFound extends Generic {
    constructor (name) {
        super('Error reference '+name+' not found');
    }
}