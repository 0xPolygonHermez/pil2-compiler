const MultiArray = require("./multi_array.js");
const ArrayOf = require('./expression_items/array_of.js');
const RangeIndex = require('./expression_items/range_index.js');
const IntValue = require('./expression_items/int_value.js');
const Context = require('./context.js');
const Debug = require('./debug.js');
const assert = require('./assert.js');

/**
 * @property {MultiArray} array
 */

class Reference {

    constructor (name, type, isReference, array, id, instance, scopeId, properties) {
        this.name = name;
        this.type = type;
        assert.typeOf(isReference, 'boolean');
        this.isReference = isReference;
        this.array = array;
        this.locator = id;
        this.scopeId = scopeId;
        this.instance = instance;
        this.initialized = false;
        for (const property in properties) {
            assert.undefined(this[property]);
            if (Debug.active) if (property === 'const') console.log(['CONST ********', properties[property]]);
            this[property] = properties[property];
        }
    }
    isValidIndexes(indexes = []) {
        // if (!Array.isArray(indexes) || indexes.length == 0) return true;
        if (!Array.isArray(indexes)) return false;
        if (indexes.length == 0) return true;
        if (!this.array) return false;
        return this.array.isValidIndexes(indexes);
    }
    markAsInitialized(indexes = []) {
        if (indexes.length === 0 || !this.array) {
            assert.strictEqual(this.initialized, false);
            this.initialized = true;
        }
        else {
            this.array.markAsInitialized(indexes);
        }
    }
    isInitialized(indexes = []) {
        return  (indexes.length === 0 || !this.array) ? this.initialized : this.array.isInitialized(indexes);
    }
    getId(indexes = []) {
        if (Debug.active) {
            console.log(`getId ${this.name} ${Array.isArray(indexes) ? '[' + indexes.join(',') + ']':indexes} ${this.array ? this.array.toDebugString():''}`);
        }
        if (indexes.length > 0 && !this.array) {
            throw new Error(`Accessing to index, but not an array ${this.name} ${Context.sourceTag}`);
        }
        // return (indexes.length > 0 || this.array) ? this.array.getLocator(this.locator, indexes) : this.locator;
        return this.array ? this.array.getLocator(this.locator, indexes) : this.locator;
    }
    set (value, indexes = [], options = {}) {
        if (Debug.active) console.stdebug(`set(${this.name}, [${indexes.join(',')}]`);
        assert.notStrictEqual(value, null); // to detect obsolete legacy uses
        if (!this.array || this.array.isFullIndexed(indexes)) {
            return this.setOneItem(value, indexes, options);
        }
        this.setArrayLevel(0, indexes, value, options);
        // At this point, it's a array initilization
    }
    setArrayLevel(level, indexes, value, options = {}) {
        if (Debug.active) console.log(`setArrayLevel(${this.name} ${level}, [${indexes.join(',')}] ${Context.sourceRef}`);
        const len = this.array.lengths[level];

        // indexes is base, over it we fill all value levels.
        const isArray = Array.isArray(value);
        const valueLen = isArray ? value.length : value.getLevelLength(indexes);
        
        if (len !== valueLen) {
            throw new Error(`Mismatch con array length (${len} vs ${valueLen}) on ${this.name}[${indexes.join('],[')}]`);
        }

        for (let index = 0; index < len; ++index) {
            let _indexes = [...indexes];
            _indexes.push(index);
            // we are on final now we could set values
            if (level + 1 === this.array.dim) {
                if (isArray) {
                    this.setOneItem(value[index], _indexes, options);
                } else {    
                    if (value.dump) value.dump();
                    const _item = value.getItem(_indexes);
                    this.setOneItem(_item, _indexes, options);
                }
                continue;
            }
            // for each possible index call recursiverly up levels
            this.setArrayLevel(level+1, _indexes, isArray ? value[index] : value, options);
        }
    }
    // setting by only one element
    setOneItem(value, indexes, options = {}) {
        if (!this.isInitialized(indexes)) {
            return this.#doInit(value, indexes);
        } else if (options.doInit) {
            // called as doInit:true but it's initizalized before
            throw new Error('value initialized');
        }
        const [row, id] = this.getRowAndId(indexes);
        if (this.const) {
            // TODO: more info
            throw new Error(`setting ${this.name} a const element on ${Context.sourceRef}`);
        }
        if (row !== false) this.instance.setRowValue(id, row, value);
        else this.instance.set(id, value);
    }
    #doInit(value, indexes) {
        const [row, id] = this.getRowAndId(indexes);
        assert.notStrictEqual(id, null);
        if (row !== false) {
            this.instance.setRowValue(id, row, value);
        } else {
            this.instance.set(id, value);
        }
        this.markAsInitialized(indexes);
    }
    init (value, indexes = [], options = {}) {
        assert.notStrictEqual(value, null); // to detect obsolete legacy uses
        this.set(value, indexes, {...options, doInit: true});
    }
    static getArrayAndSize(lengths) {
        // TODO: dynamic arrays, call to factory, who decides?
        if (lengths && lengths.length) {
            let array = new MultiArray(lengths);
            return [array, array.size];
        }
        return [false, 1];
    }
    get (indexes = []) {
        const [row, id] = this.getRowAndId(indexes);
        if (row !== false) {
            return this.instance.getRowValue(id, row);
        }
        return this.instance.get(id);
    }
    getRowAndId(indexes = []) {
        if (!this.instance.runtimeRows || indexes.length === 0) {
            return [false, this.getId(indexes)];
        }
        if (!this.array) {
            if (indexes.length === 1) {
                return [indexes[0], this.getId(indexes.slice(0, -1))];
            }
            throw new Error(`Accessing to index, but not an array ${this.name} ${Context.sourceTag}`);
        }
        if ((this.array.dim + 1) === indexes.length) {            
            // return row and the id of indexes without row
            return [indexes[indexes.length - 1], this.getId(indexes.slice(0,-1))];
        }
        // other cases managed by getId because they aren't row access
        return [false, this.getId(indexes)];
    }

    getItem(indexes, options = {}) {
        let locator = this.locator;
        let label = options.label;

        if (Debug.active) {
            console.log(indexes);
            console.log(this);
        }
        // indexes evaluation
        let evaluatedIndexes = [];
        let fromIndex = false;
        let toIndex = false;
        if (Array.isArray(indexes) && indexes.length > 0) {
            for (let index = 0; index < indexes.length; ++index) {
                if (indexes[index].isInstanceOf && indexes[index].isInstanceOf(RangeIndex)) {
                    if (index + 1 !== indexes.length) {
                        throw new Error(`Range index is valid only in last index ${Context.sourceRef}`);
                    }
                    const rangeIndex = indexes[index].getAloneOperand();
                    fromIndex = rangeIndex.from === false ? false : Number(rangeIndex.from.asInt());
                    toIndex = rangeIndex.to === false ? false : Number(rangeIndex.to.asInt());
                    continue;
                }
                if (typeof indexes[index] === 'number') {
                    evaluatedIndexes.push(BigInt(indexes[index]));
                    continue;
                }
                if (typeof indexes[index] === 'bigint') {
                    evaluatedIndexes.push(indexes[index]);
                    continue;
                }
                evaluatedIndexes.push(indexes[index].asInt());
            }
            if (label) label = label + '['+evaluatedIndexes.join('],[')+']';
        }

        // if array is defined
        let res = false;
        if (this.array) {
            if (this.array.isFullIndexed(evaluatedIndexes)) {
                // full access => result an item (non subarray)
                locator = this.array.locatorIndexesApply(this.locator, evaluatedIndexes);
            } else {
                // parcial access => result a subarray
                res = new ArrayOf(this.type, this.array.createSubArray(evaluatedIndexes, locator, fromIndex, toIndex));
            }
        } else if (evaluatedIndexes.length === 1 && this.instance.runtimeRows) {
            res = this.instance.getRowValue(locator, evaluatedIndexes[0], options);
            if (typeof res === 'undefined') {
                throw Error(`ERROR: Row ${evaluatedIndexes[0]} of ${options.label} isn't initialized`);
            }
        } else if (evaluatedIndexes.length > 0) {
            console.log('C');
            console.log(evaluatedIndexes);
            console.log(this);
            throw new Error('try to access to index on non-array value');
        }
        if (typeof res === 'bigint' || typeof res === 'number') {
            res = new IntValue(res);
        }
        if (res === false) {
            res = this.const ? this.instance.getConstItem(locator, options) : this.instance.getItem(locator, options);
        }
    
        if (label) {
            res.setLabel(label);
        } else res.setLabel('___');

        return res;
    }
}

module.exports = Reference;