const RuntimeItem = require("./runtime_item.js");
const Context = require('../context.js');
const RowOffset = require('./row_offset.js');
const ExpressionItem = require('./expression_item.js');
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
        // console.log(JSON.stringify(this, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        let cloned = new ReferenceItem(this.name, this.indexes, this.rowOffset);
        // console.log(JSON.stringify(this, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        // console.log(JSON.stringify(cloned, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        return cloned;
    }
    evalInside(options = {}) {
        if (Debug.active) {
            console.log(['EVALINSIDE '+this.name, options]);
            console.log(this.rowOffset);
            console.log(this);
            if (this.rowOffset.value) {
                console.log('ROWOFFSET.EVALINSIDE');
            }
        }
        const item = Context.references.getItem(this.name, this.indexes);
        // console.log('EVAL ITEM INSIDE '+this.name + ' ' + item.constructor.name);
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
            console.log(item.eval());
        }
        return item.eval(options);
    }
}
