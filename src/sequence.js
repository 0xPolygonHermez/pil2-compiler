const Expression = require("./expression.js");
const Values = require('./values.js');
const Debug = require('./debug.js');
const vm = require('vm');
const assert = require('./assert.js');
const Context = require('./context.js');
const SequenceSizeOf = require('./sequence/size_of.js');
const SequenceCodeGen = require('./sequence/code_gen.js');
const SequenceFastCodeGen = require('./sequence/fast_code_gen.js');
const SequenceExtend = require('./sequence/extend.js');
const SequenceToList = require('./sequence/to_list.js');
const SequenceTypeOf = require('./sequence/type_of.js');
const SequenceCompression = require('./sequence/compression.js');
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
        this.padding = false;
        this.expression = expression;

        this.maxSize = typeof maxSize === 'undefined' ? false : Number(maxSize);
        this.paddingCycleSize = false;
        this.paddingSize = 0;
        this.extendPos = 0;
        this.debug = '';
        this.valueCounter = 0;
        this.varIndex = 0;
        this.bytes = 8;         // by default
        const options = {set: (index, value) => this.#setValue(index, value),
                         get: (index) => this.#values[index]};
        this.engines = {
            sizeOf: new SequenceSizeOf(this, 'sizeOf'),
            codeGen: new SequenceFastCodeGen(this, 'codeGen'),
                                                    // : new SequenceCodeGen(this, 'codeGen'),
            extend: new SequenceExtend(this, 'extend', options),
            toList: new SequenceToList(this, 'toList', options),
            typeOf: new SequenceTypeOf(this, 'typeOf'),
            compression: new SequenceCompression(this, 'compression')
        };
        this.engines.typeOf.execute(this.expression);
        this.sizeOf(this.expression);
        this.#values = new Values(this.bytes, this.maxSize);
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
    getIntValue(index) {
        return this.#values.getValue(index);
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
        this.engines.sizeOf.updateMaxSizeWithPadingSize(this.paddingSize);
        this.bytes = this.engines.sizeOf.getMaxBytes();
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
        console.log(this.engines.compression.execute(this.expression)[0]);
        this.extendPos = 0;
        const [code, count] = this.engines.codeGen.execute(this.expression);
        const context = this.engines.codeGen.genContext();
/*
        // console.log('CODE', code);
        let __dbuf = Buffer.alloc(this.size * this.bytes)
        let context = {__dbuf, __dindex: 0};
        let __data; 
        switch (this.bytes) {
            case 1: __data = new Uint8Array(__dbuf.buffer, 0, this.size); break;
            case 2: __data = new Uint16Array(__dbuf.buffer, 0, this.size); break;
            case 4: __data = new Uint32Array(__dbuf.buffer, 0, this.size); break;
            case 8: __data = new BigInt64Array(__dbuf.buffer, 0, this.size); break;
        }
        context.__data = __data;
*/
        vm.createContext(context);
        vm.runInContext(code, context);
        this.#values.__setValues(context.__dbuf, context.__data);
        this.#values.mutable = false;
        /*
        let irow = 0;
        while (irow < this.size) {
            let _values = ['@'+irow.toString(16).padStart(8, '0')];
            for (let index = 0; index < 16; ++index) {
                _values.push(this.#values.getValue(irow + index));
                // _values.push(__data[irow + index]);
            }
            console.log(_values.join('|'));
            irow += 16;            
            if (irow === 272) {
                console.log('....');
                irow = this.size - 272;
            }
        }
        console.log('(END)');*/
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
    getBuffer() {
        return this.#values.getBuffer();
    }
}