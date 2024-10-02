const Indexable = require("./indexable.js");
const FixedColItem = require("./expression_items/fixed_col.js");
const FixedCol = require("./definition_items/fixed_col.js");
const Context = require('./context.js');
const assert = require('./assert.js');
module.exports = class FixedCols extends Indexable {

    constructor () {
        super('fixed', FixedCol, FixedColItem);
    }
    getEmptyValue(id, data) {
        return new FixedCol(id, data);
    }
    setRowValue(id, row, value) {
        const item = this.get(id);
        if (assert.isEnabled) assert.ok(item, {type: this.type, definition: this.definitionClass, id, item});
        if (typeof item.setRowValue !== 'function') {
            console.log({type: this.type, definition: this.definitionClass, id, item});
            throw new Error(`Invalid assignation at ${Context.sourceTag}`);
        }
        item.setRowValue(row, value);
        if (this.debug) {
            console.log(`SET ${this.constructor.name}.${this.type} @${id} ${value}`);
        }
    }
    getRowValue(id, row) {
        const item = this.get(id);
        if (assert.isEnabled) assert.ok(item, {type: this.type, definition: this.definitionClass, id, item});
        if (typeof item.getRowValue !== 'function') {
            console.log({type: this.type, definition: this.definitionClass, id, item});
            throw new Error(`Invalid access at ${Context.sourceTag}`);
        }
        return item.getRowValue(row);
    }
    getNonTemporalLabelRanges() {
        let res = [];
        for (const range of this.labelRanges) {
            const from = range.from;
            if (this.values[from].temporal) continue;
            res.push(range);
        }
        return res;
    }
}
