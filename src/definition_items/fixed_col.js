const ProofItem = require("./proof_item.js");
const Context = require('../context.js');
const fs = require('fs');
const IntValue = require('../expression_items/int_value.js');
// const Sequence = require("../sequence.js");

const U64_MAX = 2n**64n - 1n;
const BIG_INT = 16;

module.exports = class FixedCol extends ProofItem {
    constructor (id, data) {
        super(id);
        this.rows = 0;
        this.sequence = null;
        this.values = false;
        this.maxValue = 0;
        this.bytes = data.bytes ?? false;        
        this.temporal = data.temporal ?? false;
        this.size = 0;
        this.maxRow = 0;
        this.fullFilled = false;
        this.buffer = null;
        this.converter = x => x;
        this.currentSetRowValue = this.#setRowValue;
        // TODO: more faster option, change function that call
        // for each value to avoid verify if value is bigger than bytes specified
    }
    getId() {
        return this.id;
    }
    isPeriodic() {
        return this.rows > 0;
    }
    getValue(row) {
        return this.getRowValue(row);
    }
    setValue(value) {
        // TODO: review
        this.set(value);
    }
    valueToBytes(value) {
        if (value < 256n) return 1;
        if (value < 65536n) return 2;
        if (value < 4294967296n) return 4;
        if (value <= U64_MAX) return 8;
        return BIG_INT; // big int 
    }
    createBuffer(rows, bytes) {
        const buffer = new Buffer.alloc(rows * bytes);
        switch (bytes) {
            case 1: return [buffer, new Uint8Array(buffer.buffer, 0, rows), x => Number(x)];
            case 2: return [buffer, new Uint16Array(buffer.buffer, 0, rows), x => Number(x)];
            case 4: return [buffer, new Uint32Array(buffer.buffer, 0, rows), x => Number(x)];
            case 8: return [buffer, new BigUint64Array(buffer.buffer, 0, rows), x => x];
            case BIG_INT: return [buffer, new Array(rows), x => x];
        }
        throw new Error(`invalid number of bytes ${bytes}`);
    }
    checkIfResize(row, value) {        
        switch (this.bytes) {
            case 1: if (value >= 256n) this.resizeValues(row, value); break;
            case 2: if (value >= 65536n) this.resizeValues(row, value); break;
            case 4: if (value >= 4294967296n) this.resizeValues(row, value); break;
            case 8: if (value > U64_MAX) this.resizeValues(row, value); break;
            case BIG_INT: return;
        }
    }
    setRowValue(row, value) {
        if (this.sequence) {
            throw new Error(`setting a row value but assigned a sequence previously ${Context.sourceTag}`);
        }
        if (value && typeof value.asInt === 'function') {
            value = value.asInt();
        }
        this.currentSetRowValue(row, value);
    }
    #setRowValue(row, value) {
        value = Context.Fr.e(value);
        if (this.values === false){
            this.rows = Context.rows;
            if (this.bytes === false) {
                this.bytes = this.valueToBytes(value);
            }
            [this.buffer, this.values, this.converter] = this.createBuffer(this.rows, this.bytes);
            this.size = this.rows * this.bytes;
            this.updateSetRowValue();
        } else {
            this.checkIfResize(row, value);
        }
        if (row >= this.maxRow) this.maxRow = row;
        this.values[row] = this.converter(value);        
    }
    #fastSetRowValue(row, value) {
        value = Context.Fr.e(value);
        this.values[row] = this.converter(value);        
    }
    #ultraFastSetRowValue(row, value) {
        value = Context.Fr.e(value);
        this.values[row] = value;        
    }
    resizeValues(row, value) {
        let _bytes = this.valueToBytes(value);
        let [_buffer, _values, _converter] = this.createBuffer(this.rows, _bytes);
        const _resizeConvert = this.bytes !== BIG_INT ? x => BigInt(x) : x => x;
        for (let i = 0; i < this.maxRow; ++i) { 
            _values[i] = _resizeConvert(this.values[i]);
        }
        console.log(`\x1B[1;31mWARNING: fixed RESIZE from ${this.bytes} bytes to ${_bytes} on row ${row}/${this.maxRow} at ${Context.sourceRef}\x1B[0m`);    
        console.log(`\x1B[1;31muse #pragma fixed_bytes ${_bytes} to force initial size\x1B[0m`);    
        this.values = _values;
        this.bytes = _bytes;
        this.buffer = _buffer;
        this.converter = _converter;
        this.size = this.rows * this.bytes;
        this.updateSetRowValue();
    }
    updateSetRowValue() {
        const maxSizeValue = 2n ** BigInt(this.bytes * 8);
        if (maxSizeValue > Context.Fr.p ) {
            this.currentSetRowValue = this.bytes >= 8 ? this.#ultraFastSetRowValue : this.#fastSetRowValue;
        }
    }
    getRowValue(row) {
        if (this.sequence) {
            return this.sequence.getIntValue(row);
        }
        if (row >= this.size) {
            console.trace([row, this.rows, this.bytes, this.size]);
        }
        return BigInt(this.values[row]);
    }
    getRowItem(row) {
        return new IntValue(this.getRowValue(row));
    }
    set(value) {
        // REVIEW: cyclic references
        if (value instanceof Object) {
            if (this.sequence !== null) {
                console.log(value);
                console.log(value.asInt());
                console.log(this.sequence);
                this.sequence.dump();
                EXIT_HERE;
            }
            if (this.values.length > 0) {
                EXIT_HERE;
            }
            this.sequence = value;
            this.rows = this.sequence.size;
        }
        else {
            console.log(value);
            EXIT_HERE;
        }
    }
    clone() {
        console.log('\x1B[41mWARING: clonning a FixedCol\x1B[0m');
        let cloned = new FixedCol(this.id);
        cloned.rows = this.rows;
        cloned.values = [...this.values];
        cloned.fullFilled = this.fullFilled;
        if (this.sequence) {
            cloned.sequence = this.sequence.clone();
        }
        return cloned;
    }
    dumpToFile(filename) {
        console.log(`Dumping ${this.id} to ${filename} ......`);
        const buffer = this.sequence ? this.sequence.getBuffer() : this.values;
        fs.writeFileSync(filename, buffer, (err) => {
            if (err) {
                console.log(err);
                throw new Error(`Error saving file ${filename}: ${err}`);
            }});
    }
}
