const ProofItem = require("./proof_item.js");
const Context = require('../context.js');
// const Sequence = require("../sequence.js");
module.exports = class FixedCol extends ProofItem {
    constructor (id) {
        super(id);
        this.rows = 0;
        this.sequence = null;
        this.values = false;
        this.maxValue = 0;
        this.bytes = false;
        this.size = 0;
        this.maxRow = 0;
        this.fullFilled = false;
    }
    getId() {
        return this.id;
    }
    isPeriodic() {
        return this.rows > 0;
    }
    getValue(row) {
        return this.getRowValue(row);
        // if (this.sequence === null) {
        //     return this.values[row]
        // }
        // return this.sequence.getValue(row);
    }
    setValue(value) {
        // REVIEW
        this.set(value);
    }
    setRowValue(row, value) {
        if (this.sequence) {
            throw new Error(`setting a row value but assigned a sequence previously ${Context.sourceTag}`);
        }
        if (value && typeof value.asInt === 'function') {
            value = value.asInt();
        }
        if (this.values === false){
            this.rows = Context.rows;
            if (this.bytes === false) {
                if (value < 256n) { 
                    this.bytes = 1;
                } else if (value < 65536n) {
                    this.bytes = 2;
                } else if (value < 4294967296n) {
                    this.bytes = 4;
                } else {
                    this.bytes = 8;
                }
            }
            console.log(`allocating ${this.rows} rows of ${this.bytes} bytes`);
            this.values = Buffer.alloc(this.rows * this.bytes);
            this.size = this.rows * this.bytes;
        }

        switch (this.bytes) {
            case 1:
                if (value >= 256n) this.resizeValues(row, value);
                break;
            case 2:
                if (value >= 65536n) this.resizeValues(row, value);
                break;
            case 4:
                if (value >= 4294967296n) this.resizeValues(row, value);
                break;
        }
        if (row >= this.maxRow) this.maxRow = row;
        switch (this.bytes) {
            case 1:
                this.values.writeUInt8(Number(value), row);
                break;
            case 2:
                this.values.writeUInt16LE(Number(value), row * 2);
                break;
            case 4:
                this.values.writeUInt32LE(Number(value), row * 4);
                break;
            case 8:
                this.values.writeBigUInt64LE(value, row * 8);
                break;
        }
    }
    resizeValues(row, value) {
        let newBytes;

        if (value >= 4294967296n) newBytes = 8;
        else if (value >= 65536n) newBytes = 4;
        else newBytes = 2;

        let newValues = Buffer.alloc(this.rows * newBytes);
        let conversion = this.bytes * 10 + newBytes;
        switch (conversion) {
            case 12:
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeUInt16LE(this.values.readUInt8(irow), irow * 2);
                }
                break;
            case 14:   
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeUInt32LE(this.values.readUInt16LE(irow * 2), irow * 4);
                }
                break;
            case 18:
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeBigUInt64LE(BigInt(this.values.readUInt8(irow)), irow * 8);
                }
                break;  
            case 24:    
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeUInt32LE(this.values.readUInt16LE(irow * 2), irow * 4);
                }
                break;
            case 28:            
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeBigUInt64LE(BigInt(this.values.readUInt16LE(irow * 2)), irow * 8);
                }
                break;
            case 48:
                for (let irow = 0; irow < this.maxRow; ++irow) {
                    newValues.writeBigUInt64LE(BigInt(this.values.readUInt32LE(irow * 4)), irow * 8);
                }
                break;
        }
        console.log(`\x1B[1;31mWARNING: fixed RESIZE from ${this.bytes} bytes to ${newBytes} on row ${row}/${this.maxRow} at ${Context.sourceRef}\x1B[0m`);    
        this.values = newValues;
        this.bytes = newBytes;
        this.size = this.rows * this.bytes;
    }
    getRowValue(row) {
        if (this.sequence) {
            return this.sequence.getValue(row);
        }
        if (row >= this.size) {
            console.trace([row, this.rows, this.bytes, this.size]);
        }
        switch (this.bytes) {
            case 1: return BigInt(this.values.readUInt8(row));
            case 2: return BigInt(this.values.readUInt16LE(row * 2));
            case 4: return BigInt(this.values.readUInt32LE(row * 4));
            case 8: return this.values.readBigUInt64LE(row * 8);
        }
        throw new Error(`unknown bytes ${this.bytes}`);    
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
}
