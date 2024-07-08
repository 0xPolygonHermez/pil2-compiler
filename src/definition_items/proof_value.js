const ProofItem = require("./proof_item.js");

module.exports = class ProofValue extends ProofItem {
    constructor (id) {
        super(id);
    }
    clone() {
        return new ProofValue(this.id);
    }
}
