const Indexable = require("./indexable.js");
const AirGroupValueItem = require("./expression_items/air_group_value.js");
const AirGroupValueDefinition = require("./definition_items/air_group_value.js");
module.exports = class AirGroupValues extends Indexable {

    constructor () {
        super('airgroupvalue', AirGroupValueDefinition, AirGroupValueItem)
    }
    getRelativeLabel(airGroupId, id, options) {
        // TODO: arrays
        const value = this.values.find(x => x.relativeId == id && x.airGroupId == airGroupId);

        return value ? value.label : `airgroupvalue(${airGroupId},${id})`;
    }
    getLabelsByAirGroupId(airGroupId) {
        return this.labelRanges.toArray().filter(x => this.values[x.from].airGroupId === airGroupId);
    }
    getEmptyValue(id, options) {
        const airGroupId = options.airGroupId;
        const relativeId = this.values.reduce((res, spv) => spv.airGroupId === airGroupId ? res + 1 : res, 0);
        let definition = super.getEmptyValue(id, {relativeId, ...options});
        return definition;
    }
    getDataByAirGroupId(airGroupId) {
        let result = [];
        for (let index = 0; index < this.values.length; ++index) {
            if (this.values[index].airGroupId != airGroupId) continue;
            result.push({id: index, ...this.values[index]});
        }
        return result;
    }
    getIdsByAirGroupId(airGroupId) {
        let result = [];
        for (let index = 0; index < this.values.length; ++index) {
            if (this.values[index].airGroupId != airGroupId) continue;
            result.push(index);
        }
        return result;
    }
    getAggreationTypesByAirGroupId(airGroupId) {
        return this.values.filter(x => x.airGroupId == airGroupId).map(x => x.aggregateType);
    }
}
