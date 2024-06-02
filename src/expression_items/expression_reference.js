const ProofItem = require("./proof_item.js");
const IntValue = require('./int_value.js');
const assert = require('../assert.js');
module.exports = class ExpressionReference extends ProofItem {
    constructor (id, instance, options = {}) {
        super(options);
        this.id = id;
        this.instance = instance;
    }
    getTag() {
        return 'im';
    }
    static createFrom(value, options = {}) {
        if (assert.isEnabled) {
            assert.defined(options.id, 'ExpressionReference.createFrom need knows id');
            assert.defined(options.instance, 'ExpressionReference.createFrom need knows instance');
        }
        return new ExpressionReference(options.id, options.instance);
    }
    cloneInstance(options) {
        return new ExpressionReference(this.id, this.instance, this.options);
    }
    eval(options) {
        // check if is baseType, in this case return it.
        const value = this.instance.get(this.id).getValue();
        if (value.isBaseType) return value;

        // if not clone
        if (options && options.unroll) {
            return value.clone();
        }
        return this.clone();
    }
    evalInside(options) {
        return this;
    }
    isRuntimeEvaluable() {
        return false;
    }
    operatorEq(value) {
        if (value.instance === this.instance && value.id == this.id && this.indexes === false && value.indexes === false) {
            return new IntValue(1);
        }
        return null;
    }
}
