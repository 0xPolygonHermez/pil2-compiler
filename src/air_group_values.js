const Indexable = require("./indexable.js");
const AirGroupValueItem = require("./expression_items/air_group_value.js");
const AirGroupValueDefinition = require("./definition_items/air_group_value.js");
module.exports = class AirGroupValues extends Indexable {

    constructor () {
        super('airgroupvalue', AirGroupValueDefinition, AirGroupValueItem)
    }
    getRelativeLabel(subproofId, id, options) {
        // TODO: arrays
        const value = this.values.find(x => x.relativeId == id && x.subproofId == subproofId);

        return value ? value.label : `subproofvalue(${subproofId},${id})`;
    }
    getEmptyValue(id, options) {
        const subproofId = options.subproofId;
        const relativeId = this.values.reduce((res, spv) => spv.subproofId === subproofId ? res + 1 : res, 0);
        let definition = super.getEmptyValue(id, {relativeId, ...options});
        return definition;
    }
    getIdsBySubproofId(subproofId) {
        let result = [];
        for (let index = 0; index < this.values.length; ++index) {
            if (this.values[index].subproofId != subproofId) continue;
            result.push(index);
        }
        return result;
    }
    getAggreationTypesBySubproofId(subproofId) {
        return this.values.filter(x => x.subproofId == subproofId).map(x => x.aggregateType);
    }
}
