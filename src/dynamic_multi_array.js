
const {cloneDeep} = require('lodash');
module.exports = class DynamicMultiArray extends MultiArray {
    constructor (lengths, debug) {
        // length[0] means dynamic index
        this.dynamics = lengths.map(x => x == 0);
        super(lengths, debug);
    }
    clone() {
        let cloned = new DynamicMultiArray(this.lengths, this.debug);
        cloned.dynamics = [...this.dynamics];
        return cloned;
    }
    /*
    // assignation to indicate if allowed to increase one element
    checkIndexes(indexes, assignation = false) {
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
    getIndexesOffset(indexes) {
        return this.getIndexesTypedOffset(indexes).offset;
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
    createSubArray(dim) {
        return new MultiArray(this.lengths.slice(-dim));
    }
    applyIndexes(obj, indexes) {
        const res = this.getIndexesTypedOffset(indexes);
        let dup = obj.clone()
        if (dup.id) {
            dup.id = dup.id + res.offset;
        }
        if (dup.array) {
            dup.array = res.array;
        }
        return dup;
    }
    getIndexesOffset(indexes) {
        if (indexes === null || typeof indexes === 'undefined') {
            // TODO: review
            return {offset: 0, array: this.createSubArray(this.offsets.length)};
        }
        let offset = 0;
        const dims = Math.min(this.offsets.length, indexes.length);
        for (let idim = 0; idim < dims; ++idim) {
            if (Number(indexes[idim]) >= this.lengths[idim]) return [false, idim];
            offset += this.offsets[idim] * Number(indexes[idim]);
        }
        return [offset, dims];
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
    }*/
}

