const Generic = require('./generic.js');
module.exports = class ReferenceNotVisible extends Generic {
    constructor (name) {
        super('Error reference '+name+' not visible/accesible');
    }
}