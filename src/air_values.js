const Indexable = require("./indexable.js");
const AirValueItem = require("./expression_items/air_value.js");
const AirValueDefinition = require("./definition_items/air_value.js");
module.exports = class AirValues extends Indexable {

    constructor () {
        super('airvalue', AirValueDefinition, AirValueItem)
    }
    getRelativeLabel(id, options) {
        // TODO: arrays
        const value = this.values.find(x => x.relativeId == id);

        return value ? value.label : `airvalue(${id})`;
    }
    getEmptyValue(id, options) {
        const relativeId = this.values.reduce((res, spv) => spv.airGroupId === airGroupId ? res + 1 : res, 0);
        let definition = super.getEmptyValue(id, {relativeId, ...options});
        return definition;
    }
}
