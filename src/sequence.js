const Expression = require("./expression.js");
const Values = require('./values.js');
const Debug = require('./debug.js');
const vm = require('vm');
const assert = require('./assert.js');
const Context = require('./context.js');
const SequenceSizeOf = require('./sequence/size_of.js');
const SequenceCodeGen = require('./sequence/code_gen.js');
const SequenceExtend = require('./sequence/extend.js');
const SequenceToList = require('./sequence/to_list.js');
const SequenceTypeOf = require('./sequence/type_of.js');
const IntValue = require('./expression_items/int_value.js');
const ExpressionList = require('./expression_items/expression_list.js');

const MAX_ELEMS_GEOMETRIC_SEQUENCE = 300;
class SequencePadding {
    constructor (value, size) {
        this.value = value;
        this.size = size;
    }
}
module.exports = class Sequence {
    #values;

    static cacheGeomN = [];
    // TODO: Review compiler estructures
    // TODO: iterator of values without "extend"
    // TODO: check repetitive sequences (times must be same)
    // TODO: check arith_seq/geom_seq with repetitive

    constructor (expression, maxSize) {
        this.#values = new Values();
        this.padding = false;
        this.expression = expression;

        this.maxSize = typeof maxSize === 'undefined' ? false : Number(maxSize);
        this.paddingCycleSize = false;
        this.paddingSize = 0;
        this.extendPos = 0;
        this.debug = '';
        this.valueCounter = 0;
        this.varIndex = 0;
        const options = {set: (index, value) => this.#setValue(index, value),
                         get: (index) => this.#values[index]};
        this.engines = {
            sizeOf: new SequenceSizeOf(this, 'sizeOf'),
            codeGen: new SequenceCodeGen(this, 'codeGen'),
            extend: new SequenceExtend(this, 'extend', options),
            toList: new SequenceToList(this, 'toList', options),
            typeOf: new SequenceTypeOf(this, 'typeOf')
        };
        this.engines.typeOf.execute(this.expression);
        this.sizeOf(this.expression);
    }
    get isSequence () {
        return this.engines.typeOf.isSequence;
    }
    get isList () {
        return this.engines.typeOf.isList;
    }
    clone() {
        let cloned = new Sequence(this.expression, this.maxSize);
        if (Debug.active) console.log(['CLONED', this.maxSize, cloned.maxSize]);
        this.#values.mutable = false;
        cloned.#values = this.#values.clone();
        return cloned;
    }
    getValue(index) {
        return new IntValue(this.#values.getValue(index));
    }
    #setValue(index, value) {
        ++this.valueCounter;
        return this.#values.__setValue(index, value);
    }
    setValue(index, value) {
        if ((index >= 0 && (this.maxSize === false || index < this.maxSize) === false)) {
            console.log(`\x1B[33mERROR Invalid value of extendPos:${index} maxSize:${this.maxSize}  ${this.debug}\x1B[0m`);
        }
        if (typeof this.#values.getValue(index) !== 'undefined') {
            console.log(`\x1B[33mERROR Rewrite index position:${index} ${this.debug}\x1B[0m`);
        }
        ++this.valueCounter;
        return this.#values.setValue(index, value);
    }
    sizeOf(e) {
        this.paddingCycleSize = false;
        this.paddingSize = 0;
        const size = this.engines.sizeOf.execute(e);
        assert.ok(size >= this.paddingCycleSize, `size(${size}) < paddingCycleSize(${this.paddingCycleSize})`);
        if (Debug.active) {
            console.log(['SIZE(MAXSIZE)', this.maxSize]);
            console.log(['SIZE(paddingCycleSize)', this.paddingCycleSize]);
            console.log(['SIZE(paddingSize)', this.paddingSize]);
        }
        if (this.paddingCycleSize) {
            this.paddingSize = this.maxSize - (size - this.paddingCycleSize);
            this.size = size - this.paddingCycleSize + this.paddingSize;
        } else {
            this.size = size;
        }
        if (Debug.active) console.log(['SIZE', this.size]);
        return this.size;
    }
    toList() {
        this.engines.toList.execute(this.expression);
        return new ExpressionList(this.#values.getValues());
    }
    setPaddingSize(size) {
        if (this.maxSize === false) {
            throw new Error(`Invalid padding sequence without maxSize at ${this.debug}`);
        }
        if (this.paddingCycleSize !== false) {
            throw new Error(`Invalid padding sequence, previous padding sequence already has been specified at ${this.debug}`);
        }
        this.paddingCycleSize = size;
        return this.paddingCycleSize;
    }
    extend() {
        if (Debug.active) console.log(this.size);
        this.extendPos = 0;
        const [code, count] = this.engines.codeGen.execute(this.expression);
        let __values = [];
        const context = {__values}
        vm.createContext(context);
        vm.runInContext(code, context);
        this.#values.__setValues(__values);
        this.#values.mutable = false;
    }
    verify() {
        if (!assert.isEnabled) return;

        if (Debug.active) {
            console.log(this.toString());
            console.log([this.extendPos, this.size]);
            console.log(['SIZE', this.size]);
        }
        assert.strictEqual(this.valueCounter, this.size);
        for (let index = 0; index < size; ++index) {
            assert.typeOf(this.values[index], 'bigint', `type of index ${index} not bigint (${typeof this.values[index]}) ${value}`);
        }
    }
    toString() {
        return this.#values.toString();
    }
    getValues() {
        return this.#values.getValues();
    }
}