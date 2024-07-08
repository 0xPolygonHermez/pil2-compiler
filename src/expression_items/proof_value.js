const ProofItem = require("./proof_item.js");

module.exports = class ProofValue extends ProofItem {
    constructor (id) {
        super(id);
    }
    getTag() {
        return 'proofvalue';
    }
    cloneInstance() {
        return new ProofValue(this.id);
    }
}
