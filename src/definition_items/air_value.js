const ProofStageItem = require("./proof_stage_item.js");
const assert = require('../assert.js');
module.exports = class AirValue extends ProofStageItem {
    constructor (id, data = {}) {
        super(id, data.stage);
        this.sourceRef = data.sourceRef;
        this.label = data.label;
        this.relativeId = data.relativeId ?? false;
    }
    clone() {
        return new AirValue(this.id, {  stage: this.stage, 
                                        sourceRef: this.sourceRef,
                                        label: (this.label && typeof this.label.clone === 'function') ? this.label.clone : this.label});
    }
}
