const ProofItem = require("./proof_item.js");
const assert = require('../assert.js');
module.exports = class AirGroupValue extends ProofItem {
    constructor (id, data = {}) {
        super(id);
        const subproofId = data.subproofId ?? false;
        assert.strictEqual(typeof data.subproofId, 'number');
        this.airgroupId = subproofId;
        this.aggregateType = data.aggregateType;
        this.sourceRef = data.sourceRef;
        this.airgroupId = data.airgroupId;
        this.label = data.label;
        this.relativeId = data.relativeId ?? false;
    }
    clone() {
        return new AirGroupValue(this.id, {aggregateType: this.aggregateType,
                                         sourceRef: this.sourceRef,
                                         airgroupId: this.airgroupId,
                                         label: (this.label && typeof this.label.clone === 'function') ? this.label.clone : this.label});
    }
}
