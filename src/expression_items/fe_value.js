const LabelRanges = require("../label_ranges.js");
const ValueItem = require("./value_item.js");

module.exports = class FeValue extends ValueItem {
    constructor (value = 0n) {
        super(value);
    }
    cloneInstance() {
        return new FeValue(this.value);
    }
    asInt() {
        return this.value;
    }
    asNumber() {
        return Number(this.value);
    }
}
