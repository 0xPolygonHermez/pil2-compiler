const Generic = require('./generic.js');
module.exports = class CannotBeCastToType extends Generic {
    constructor (castingType = false) {
        super('Error casting type '+ (castingType === false ? '':' to '+castingType));
    }
}