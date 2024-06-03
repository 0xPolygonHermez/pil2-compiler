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
        console.log('CLONE_INSTANCE #'+this.id);
        return new FixedCol(this.id);
    }
    cloneUpdate(source) {
        console.log('CLONE_UPDATE #'+this.id);
        this.definition = source.definition;
    }
}
