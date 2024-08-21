const ProofItem = require("./proof_item.js");
const assert = require('../assert.js');
module.exports = class ProofStageItem extends ProofItem {
    constructor (id, stage) {
        super(id);
        this.stage = stage;
    }
    getStage() {
        return this.stage;
    }
}

