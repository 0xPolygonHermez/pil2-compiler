const util = require('util');
const LabelRanges = require('./label_ranges.js');
const Expression = require('./expression.js');
const WitnessCol = require('./expression_items/witness_col.js');
const NonRuntimeEvaluable = require('./non_runtime_evaluable.js');
const ExpressionPacker = require('./expression_packer.js');
const Context = require('./context.js');
const assert = require('./assert.js');
module.exports = class Expressions {
    constructor () {
        this.expressions = [];
        this.packedIds = [];
        this.labelRanges = new LabelRanges();
    }
    clone() {
        let cloned = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        cloned.expressions = this.expressions.map(x => x.clone());
        cloned.labelRanges = this.labelRanges.clone();

        return cloned;
    }
    reserve(count, label, multiarray) {
        const id = this.expressions.length;
        for (let times = 0; times < count; ++times) {
            this.expressions.push(null);
        }
        if (label) {
            this.labelRanges.define(label, id, multiarray);
        }
        return id;
    }
    getTypedValue(id, offset, type) {
        assert.strictEqual(offset === 0);
        const res = { type, value: this.expressions[id], id };
        return res;
    }
    get(id) {
        if (this.isDefined(id)) {
            return this.expressions[id];
        }
        return null;
    }

    isDefined(id) {
        return (id in this.expressions);
    }

    define(id, expr) {        
        assert.equal(this.isDefined(id), false, `${id} already defined on ....`);
        this.expressions[id] = expr;
    }

    set(id, expr) {
        this.expressions[id] = expr;
    }

    update(id, expr) {
        this.expressions[id] = expr;
    }

    insert(e) {
        return this.expressions.push(e) - 1;
    }
    checkExpression(e) {
        if (typeof e === 'undefined' || e.expr || !(e instanceof Expression)) {
            console.log(e)
            throw new Exceptions.Generic(`Invalid eval argument, it must be an Expression`);
        }
        return e;
    }
    eval(e) {
        return this.checkExpression(e).eval();
    }
    evalReference(e) {
        const ref = this.evalReferenceValue(e);
        console.log(ref);
        EXIT_HERE;
    }
    evaluateValues(e, valuesCount, fr) {
        // TODO: check valuesCount
        const a = this.eval(e.values[0], fr);
        let simple = (a.op === 'number');
        if (valuesCount == 1) {
            return [a, a, simple];
        }
        const b = this.eval(e.values[1], fr);
        simple = simple && (b.op === 'number');

        return [a, b, simple];
    }

    *[Symbol.iterator]() {
        for (let expr of this.expressions) {
          yield expr;
        }
    }
    getLabel(type, id, options) {
        if (type === 'im') {
            return this.labelRanges.getLabel(id, options);
        }
        return Context.references.getLabel(type, id, options);
    }
    pack(container, options) {
        this.packedIds = [];
        const packer = new ExpressionPacker();
        for (let id = 0; id < this.expressions.length; ++id) {
            if (typeof this.packedIds[id] !== 'undefined') continue;    // already packed
            // this.expressions[id].dump('PACK-EXPRESSION ');
            packer.set(container, this.expressions[id]);
            this.packedIds[id] = assert.returnTypeOf(packer.pack(options), 'number');
            // packedId === false, means directly was a alone term.
        }
    }
    getPackedExpressionId(id, container, options) {
        if (container && typeof this.packedIds[id] === 'undefined') {
            if (typeof this.expressions[id] === 'undefined') {
                debugger;
            }
            const packer = new ExpressionPacker(container, this.expressions[id]);
            this.packedIds[id] = assert.returnTypeOf(packer.pack(options), 'number');
        }
        return this.packedIds[id];
    }
    instance(e) {
        return e.instance();
    }

    dump(name) {
        for (let index = 0; index < this.expressions.length; ++index) {
            this.expressions[index].dump(`EXPRESSION ${index} # ${name}`, 3);
        }
    }
    clear(label = '') {
        this.expressions = [];
        this.packedIds = [];
        this.labelRanges = new LabelRanges();
    }

    *[Symbol.iterator]() {
        for (let index = 0; index < this.expressions.length; ++index) {
          yield this.expressions[index] ?? false;
        }
    }
}
