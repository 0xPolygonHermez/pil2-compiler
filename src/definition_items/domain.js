const ProofItem = require("./proof_item.js");
const DomainItem = require('../expression_items/domain.js');
const Context = require('../context.js');
const { log2 } = require('../utils.js');

// A domain is a row selector. It's declared with a sequence of 0/1 whose size
// (the cycle) must be a power of two, and it's stored as the log2 of that cycle
// plus the offsets inside the cycle where the value is 1, because that's how the
// pilout represents it.
//
//     domain LIMITS_16 = [1,0:14,1];      cycleBits: 4, offsets: [0,15]
//     domain FIRST = [1,0...];            cycleBits: log2(N), offsets: [0]
module.exports = class Domain extends ProofItem {
    constructor (id, data = {}) {
        super(id);
        this.sourceRef = data.sourceRef;
        this.label = data.label ?? false;
        this.cycle = 0;
        this.cycleBits = 0;
        this.offsets = [];
        if (data.sequence) {
            this.setSequence(data.sequence);
        }
    }
    get name() {
        return this.label || `domain@${this.id}`;
    }
    setSequence(sequence) {
        this.cycle = sequence.size;
        if (this.cycle < 1 || (this.cycle & (this.cycle - 1)) !== 0) {
            throw new Error(`Domain ${this.name} has a cycle of ${this.cycle} rows, but it must be a power of 2 at ${this.sourceRef ?? Context.sourceRef}`);
        }
        this.cycleBits = log2(this.cycle);
        this.offsets = [];
        for (let index = 0; index < this.cycle; ++index) {
            const value = sequence.getIntValue(index);
            if (value === 1n) {
                this.offsets.push(index);
            } else if (value !== 0n) {
                throw new Error(`Domain ${this.name} has the value ${value} on row ${index}, but only 0 or 1 are allowed at ${this.sourceRef ?? Context.sourceRef}`);
            }
        }
        if (this.offsets.length === 0) {
            throw new Error(`Domain ${this.name} doesn't select any row at ${this.sourceRef ?? Context.sourceRef}`);
        }
    }
    get value () {
        return new DomainItem(this.id);
    }
    getItem() {
        return new DomainItem(this.id);
    }
    isPeriodic() {
        return this.cycle > 0 && this.cycle < Number(Context.rows);
    }
    getRowCount() {
        return this.cycle;
    }
    clone() {
        let cloned = new Domain(this.id, {sourceRef: this.sourceRef, label: this.label});
        cloned.cycle = this.cycle;
        cloned.cycleBits = this.cycleBits;
        cloned.offsets = [...this.offsets];
        return cloned;
    }
    toString() {
        return `Domain@${this.id}(${this.label || ''} cycleBits:${this.cycleBits} offsets:${this.offsets.join()})`;
    }
}
