const Indexable = require("./indexable.js");
const FixedColItem = require("./expression_items/fixed_col.js");
const FixedCol = require("./definition_items/fixed_col.js");
const Context = require('./context.js');
const assert = require('./assert.js');
const Exceptions = require('./exceptions.js');
module.exports = class FixedCols extends Indexable {

    constructor () {
        super('fixed', FixedCol, FixedColItem);
    }
    getEmptyValue(id) {
        return new FixedCol(id);
    }
    setRowValue(id, row, value) {
        const item = this.get(id);
        if (assert.isEnabled) assert.ok(item, {type: this.type, definition: this.definitionClass, id, item});
        if (typeof item.setRowValue !== 'function') {
            console.log({type: this.type, definition: this.definitionClass, id, item});
            throw new Exceptions.Generic(`Invalid assignation`);
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
            throw new Exceptions.Generic(`Invalid access`);
        }
        return item.getRowValue(row);
    }
}
