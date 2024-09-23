const ProofItem = require("./proof_item.js");
const Context = require('../context.js');
const fs = require('fs');
// const Sequence = require("../sequence.js");
module.exports = class FixedCol extends ProofItem {
    constructor (id) {
        super(id);
        this.rows = 0;
        this.sequence = null;
        this.values = [];
        this.fullFilled = false;
    }
    getId() {
        return this.id;
    }
    isPeriodic() {
        return this.rows > 0;
    }
    getValue(row) {
        if (this.sequence === null) {
            return this.values[row]
        }
        return this.sequence.getValue(row);
    }
    setValue(value) {
        // REVIEW
        this.set(value);
    }
    setRowValue(row, value) {
        if (this.sequence) {
            throw new Error(`setting a row value but assigned a sequence previously ${Context.sourceTag}`);
        }
        this.values[row] = value;
    }
    getRowValue(row) {
        if (this.sequence) {
            return this.sequence.getValue(row);
        }
        return this.values[row];
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
        let cloned = new FixedCol(this.id);
        cloned.rows = this.rows;
        cloned.values = [...this.values];
        cloned.fullFilled = this.fullFilled;
        if (this.sequence) {
            cloned.sequence = this.sequence.clone();
        }
        return cloned;
    }
    dumpToFile(filename, bytes) {
        console.log(`Dumping ${this.id} to ${filename} ......`);
        if (bytes !== 1) {
            throw new Error(`Invalid number of bytes ${bytes} for store fixed column ${this.id}`);    
        }
        const _values = this.sequence ? this.sequence.getValues() : this.values;

        const buffer = Buffer.alloc(_values.length);
        const values = new Uint8Array(buffer.buffer, 0, _values.length);
        for (let i = 0; i < _values.length; ++i) {
            values[i] = Number(_values[i]);
        }
    
        // const buffer = Buffer.from(this.sequence.getValues());
        fs.writeFileSync(filename, buffer, (err) => {
            if (err) {
                console.log(err);
                throw new Error(`Error saving file ${filename}: ${err}`);
            }});
    }
}
