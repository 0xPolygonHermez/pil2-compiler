const RuntimeItem = require("./runtime_item.js");
const Context = require('../context.js');
const RowOffset = require('./row_offset.js');
const ExpressionItem = require('./expression_item.js');
const ExpressionReference = require('./expression_reference.js');
const Debug = require('../debug.js');
const util = require('util');
module.exports = class ReferenceItem extends RuntimeItem {
    constructor (name, indexes = [], rowOffset) {
        super();
        this.name = name;
        try {
            this.indexes = indexes.map(index => index.clone());
        } catch (e) {
            console.log(indexes);
            throw e;
        }
        // TODO: next as expression
        this.rowOffset = RowOffset.factory(rowOffset);
    }
    get isReferencedType() {
        return true;
    }
    set locator (value) {
        throw new Error(`setting locator on reference ${this.name} ${this.indexes.length}`);
    }
    dump(options) {
        return 'ReferenceItem('+this.toString(options)+')';
    }
    toString(options) {
        const [pre,post] = this.getRowOffsetStrings();
        const _indexes = [];
        if (this.indexes.length) {
            for (const index of this.indexes) {
                _indexes.push(index.toString(options));
            }
        }
        return `${pre}${this.name}${this.indexes.length > 0 ? '['+_indexes.join('][')+']':''}${post}`;
    }
    cloneInstance() {
        let cloned = new ReferenceItem(this.name, this.indexes, this.rowOffset);
        return cloned;
    }
    evalInside(options = {}) {
        return this.evalInsideExtra().result;
    }

    evalInsideExtra(options = {}) {
        if (Debug.active) {
            console.log(['EVALINSIDE '+this.name, options]);
            console.log(this.rowOffset);
            console.log(this);
        }
        const item = Context.references.getItem(this.name, this.indexes);
        if (item.isEmpty()) {
            throw new Error(`accessing to ${item.label} before his initialization at ${Context.sourceRef}`);
        }
        if (this.rowOffset && !this.rowOffset.isZero()) {
            item.rowOffset = this.rowOffset.clone();
        }
        // TODO: next
        if (Debug.active) {
            console.log(`REFERENCE ${this.name} [${this.indexes.join('][')}]`)
            console.log(item);
            console.log(item.eval(options));
        }
        return {result: item.eval(options), isExpression: item.isExpression || item instanceof ExpressionReference};
    }
}
