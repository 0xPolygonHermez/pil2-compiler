const ProofItem = require("./proof_item.js");
const FixedRow = require('./fixed_row.js');
// const Sequence = require("../sequence.js");
module.exports = class FixedCol extends ProofItem {
    constructor (id) {
        super(id);
    }
    getId() {
        return this.id;
    }
    isPeriodic() {
        return this.definition.isPeriodic();
    }
    getTag() {
        return 'fixed';
    }
    getValue(row) {
        return this.definition.getValue(row);
    }
    getRowItem(row) {
        return new FixedRow(this,row);
    }
    set(value) {
        this.definition.setValue(value);
    }
    cloneInstance() {
        return new FixedCol(this.id);
    }
    cloneUpdate(source) {
        this.definition = source.definition;
    }
}
