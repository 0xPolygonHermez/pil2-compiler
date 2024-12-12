const ProofStageItem = require("./proof_stage_item.js");
const assert = require('../assert.js');
module.exports = class ProofValue extends ProofStageItem {
    constructor (id, data = {}) {
        super(id, data.stage);
        this.sourceRef = data.sourceRef;
        this.label = data.label;
    }
    clone() {
        return new ProofValue(this.id, {stage: this.stage, sourceRef: this.sourceRef,
               label: (this.label && typeof this.label.clone === 'function') ? this.label.clone : this.label});
    }
}
