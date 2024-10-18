const Indexable = require("./indexable.js");
const AirValueItem = require("./expression_items/air_value.js");
const AirValueDefinition = require("./definition_items/air_value.js");
module.exports = class AirValues extends Indexable {
    constructor () {
        super('airvalue', AirValueDefinition, AirValueItem)
    }
    getLabels(dataFields = []) {
        let labels = [];
        for (const label of this.labelRanges) {
            const value = this.values[label.from];
            let data = {};
            for (const field of dataFields) {
                data[field] = value[field];
            }
            labels.push({...label, data});
        }
        return labels;
    }
}
