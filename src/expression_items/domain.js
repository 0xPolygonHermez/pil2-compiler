const ProofItem = require("./proof_item.js");
module.exports = class Domain extends ProofItem {
    constructor (id) {
        super(id);
    }
    get degree() {
        return 0;
    }
    getTag() {
        return 'domain';
    }
    cloneInstance() {
        return new Domain(this.id);
    }
}
