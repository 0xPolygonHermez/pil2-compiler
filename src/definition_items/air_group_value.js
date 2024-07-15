const ProofItem = require("./proof_item.js");
const assert = require('../assert.js');
module.exports = class AirGroupValue extends ProofItem {
    constructor (id, data = {}) {
        super(id);
        const airGroupId = data.airGroupId ?? false;
        assert.strictEqual(typeof data.airGroupId, 'number');
        this.airGroupId = airGroupId;
        this.aggregateType = data.aggregateType;
        this.sourceRef = data.sourceRef;
        this.label = data.label;
        this.relativeId = data.relativeId ?? false;
    }
    clone() {
        return new AirGroupValue(this.id, {aggregateType: this.aggregateType,
                                         sourceRef: this.sourceRef,
                                         airGroupId: this.airGroupId,
                                         label: (this.label && typeof this.label.clone === 'function') ? this.label.clone : this.label});
    }
}
