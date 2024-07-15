const ProofItem = require("./proof_item.js");
module.exports = class AirGroupValue extends ProofItem {
    constructor (id) {
        super(id);
    }
    getTag() {
        return 'airgroupvalue';
    }
    cloneInstance() {
        return new AirGroupValue(this.id);
    }
}
