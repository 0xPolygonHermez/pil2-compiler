const assert = require('./assert.js');
const Debug = require('./debug.js');
class MultiArray {
    static ErrorIndexOutOfRange = class extends Error {
    }
    constructor (lengths, options = {}) {
        // baseOffset is accumulated offset, means parentOffset + new offset.
        this.baseOffset = options.baseOffset ?? 0;
        if (assert.isEnabled) {
            assert.ok(Array.isArray(lengths), lengths);
            assert.ok(lengths.every(x => typeof x === 'number'), lengths);
        }
        this.initOffsets(lengths);

        // if parentInitizalized means need to extract
        if (options.parentInitialized) {
            // calculate relative offset from parent because initialized contains only
            // parent initialized values.
            const offset = this.baseOffset - options.parentOffset ?? 0;
            this.initialized = options.parentInitialized.slice(offset, offset + this.size);
        } else {
            this.initialized = options.initialized ?? [];
        }
    }
    toDebugString() {
        return '['+ this.lengths.join(',')+']';
    }
    clone() {
        const cloned = new MultiArray(this.lengths, {
            baseOffset: this.baseOffset,
            initialized: [...this.initialized]});
        return cloned;
    }
    createSubArray(indexes, locatorOffset, from = false, to = false) {
        let [offset, dims] = this.getIndexesOffset(indexes);
        const dim = this.offsets.length - dims;
        let _lengths = this.lengths.slice(-dim);
        if (from !== false || to !== false) {
            assert.equal(dim, 1);
            if (to === false) {
                assert.ok(from < _lengths[0]);
                _lengths[0] = _lengths[0] - to;
                offset += to 
            } else if (from === false) {
                assert.ok(to < _lengths[0]);
                _lengths[0] = to + 1;
            } else {
                assert.ok(to < _lengths[0] && from < _lengths[0] && from <= to);
                _lengths[0] = to - from + 1;
                offset += from 
            }
            console.log(this.lengths, dim, _lengths, offset, from, to);
        }
        const cloned = new MultiArray(_lengths, {
            baseOffset: this.baseOffset + offset + locatorOffset,
            parentOffset: this.baseOffset,
            parentInitialized: this.initialized });
        return cloned;
    }
    checkIndexes(indexes) {
        if (indexes === null || typeof indexes === 'undefined') {
           if (this.dim === 0) return true;
           throw Error('Invalid index access'); // TODO: extra debug info
        } else if (indexes.length !== this.dim) {
            throw Error('Mismatch index valid access'); // TODO: extra debug info
        }
        for (let i = 0; i < indexes.length; ++i) {
            if (indexes[i] < 0 || indexes[i] >= this.lengths[i]) {
                throw Error(`Invalid index ${indexes[i]} on index ${i}`); // TODO: extra debug info
            }
        }
    }
    getLevelLength(indexes) {
        return this.getLength(indexes.length);
    }
    getLocator(baseLocator, indexes = []) {
        const offset = this.indexesToOffset(indexes);
        return baseLocator + offset;
    }
    // review
    __getIndexesOffset(indexes) {
        return this.getIndexesTypedOffset(indexes).offset;
    }
    offsetToIndexesString(offset) {
        return '['+this.offsetToIndexes(offset).join('][')+']';
    }
    offsetToIndexes(offset) {
        let level = 0;
        let indexes = [];
        while (level < this.dim) {
            const size = this.offsets[level];
            indexes.push(Math.floor(offset/size));
            offset = offset % size;
            ++level;
        }
        return indexes;
    }
    applyIndexes(obj, indexes) {
        const res = this.getIndexesTypedOffset(indexes);
        if (res.array === false && typeof obj.getItem === 'function') {
            return obj.getItem(indexes);
        }
        let dup = obj.clone()
        if (dup.id) {
            dup.id = dup.id + res.offset;
        }
        if (dup.array) {
            dup.array = res.array;
        }
        return dup;
    }
    isFullIndexed(indexes) {
        // in case of elements with row-dimension
        return (indexes.length == this.dim);
    }
    isOverIndexed(indexes) {
        // in case of elements with row-dimension
        return (indexes.length > this.dim);
    }
    isSubIndexed(indexes) {
        // in case of elements with row-dimension
        return (indexes.length < this.dim);
    }
    locatorIndexesApply(locatorId, indexes) {
        if (Debug.active) console.log([locatorId, indexes, this.dim, this.lengths]);
        const [offset, dims] = this.getIndexesOffset(indexes);
        if (Debug.active) console.log([offset, dims]);
        if ((this.dim - dims) > 0) {
            throw new Error(`ERROR ON ARRAY ${offset} ${dims} ${this.dim}`);
        }
        return locatorId + offset;
    }
    indexesToOffset(indexes) {
        assert.defined(indexes);
        assert.ok(Array.isArray(indexes));
        const [offset, dim] = this.getIndexesOffset(indexes);


        // assert.strictEqual(this.offsets.length,indexes.length);


        return offset;
    }
    insideOfBounds(indexes) {
        for (let idim = 0; idim < indexes.length; ++idim) {
            if (Number(indexes[idim]) >= this.lengths[idim]) return false;
        }
        return true;
    }

    getIndexesOffset(indexes) {
        if (indexes === null || typeof indexes === 'undefined') {
            // TODO: review
            EXIT_HERE;
            return {offset: 0, array: this.createSubArray(this.offsets.length)};
        }
        let offset = 0;
        const dims = Math.min(this.offsets.length, indexes.length);
        for (let idim = 0; idim < dims; ++idim) {
            if (Number(indexes[idim]) >= this.lengths[idim]) return [false, idim];
            offset += this.offsets[idim] * Number(indexes[idim]);
        }
        return [offset + this.baseOffset, dims];
    }
    isValidIndexes(indexes) {
        const [offset, dims] = this.getIndexesOffset(indexes);
        return (offset !==  false && offset < this.size && dims === indexes.length) ? 1n : 0n;
    }
    getIndexesTypedOffset(indexes) {
        const [offset,dims] = this.getIndexesOffset(indexes);
        if (offset === false) {
            throw new ErrorIndexOutOfRange(`Internal error on variable index access index:${indexes[dims]} valid range:[0-${this.lengths[dims]-1}]`);
        }
        if (offset >= this.size) {
            throw new ErrorIndexOutOfRange(`Internal error on variable index access index:${offset} valid range:[0-${this.size-1}]`);
        }
        const dim = this.offsets.length - dims;
        if (dim === 0) {
            return {offset, array: false};
        }
        EXIT_HERE;
        // return {offset, dim, lengths: dim ? this.lengths.slice(-dim):[], array: this.createSubArray(dim)};
        return {offset, array: this.createSubArray(dim)};
    }
    initOffsets(lengths) {
        this.lengths = lengths;
        this.dim = Array.isArray(lengths) ? lengths.length: 0
        let offsets = [1];
        let size = 1;
        for (let idim = this.dim - 1; idim > 0; --idim) {
            size = size * lengths[idim];
            offsets.push(size);
        }
        // for size multiplies first offset by length of first dimension
        this.size = size * lengths[0];

        // for offsets first index length isn't rellevant
        this.offsets = offsets.reverse();
    }
    getLengths() {
        return this.lengths;
    }
    getSize() {
        return this.size;
    }
    getLength(dim = 0) {
        return this.lengths[dim] ?? 0;
    }
    getDim() {
        return this.lengths.length ?? 0;
    }
    isInitialized(indexes) {
        const offset = this.indexesToOffset(indexes);
        return this.initialized[offset] ?? false;
    }
    markAsInitialized(indexes) {
        const offset = this.indexesToOffset(indexes);
        this.initialized[offset] = true;
    }
}

module.exports = MultiArray;
