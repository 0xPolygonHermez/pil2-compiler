const ExpressionItem = require("./expression_item.js");
const IntValue = require('./int_value.js');

module.exports = class ProofItem extends ExpressionItem {
    static createWithId = true;
    constructor (id) {
        super();
        this.id = id;
    }
    getId() {
        return this.id;
    }
    getLabel(options) {
        const manager = this.getManager();
        if (!manager) return '';
        return manager.getLabel(this.id, options);
    }
    dump(options) {
        const [pre,post] = this.getRowOffsetStrings();
        options = options ?? {};
        const defaultType = options.type ? options.type : this.constructor.name;
        if (!options.label && !options.hideLabel && options.dumpToString) {
            options = {...options, label: this.getLabel(options)};
        }
        const label = options.label ? options.label : `${defaultType}@${this.id}`;
        return `${pre}${label}${post}`;
    }
    eval(options) {
        return this.clone();
    }
    isRuntimeEvaluable() {
        return false;
    }
    cloneUpdate(source) {
        super.cloneUpdate(source);
        if (source.rowOffset) {
            this.rowOffset = source.rowOffset.clone();
        }
    }
    toString(options = {}) {
        const [next, prior] = this.getRowOffsetStrings();
        // console.log(['ROWOFFSET.TOSTRING', next, prior, this.label, this.constructor.name, this.rowOffset]);
        let label = (options.hideClass ? '' : this.getTag() + '::') + this.label;
        if (options.hideLabel || !this.label) {
            label = this.getTag() + '@' + this.id;
        }
        return next + label + prior;
    }
    operatorEq(b) {
        return new IntValue(this.id === b.id ? 1:0);
    }
}

