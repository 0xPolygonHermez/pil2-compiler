const ProofItem = require("./proof_item.js");
const FixedRow = require('./fixed_row.js');
const Context = require('../context.js');
const IntValue = require("./int_value.js");
// const Sequence = require("../sequence.js");
module.exports = class FixedCol extends ProofItem {
    constructor (id) {
        super(id);
        this.rowOffsetApply = true;
    }
    get degree() {
        return 1;
    }
    getId() {
        return this.id;
    }
    isPeriodic() {
        return this.definition.isPeriodic();
    }
    getTag() {
        return 'fixed';
    }
    getValue(row) {
        return this.definition.getValue(row);
    }
    getValueItem(row) {
        return this.definition.getValueItem(row);
    }
    getValues() {
        return this.definition.getValues();
    }
    getRowItem(row, rowOffset) {
        return new FixedRow(this,row, rowOffset);
    }
    getRowCount() {
        return this.definition.getRowCount();
    }
    set(value) {
        this.definition.setValue(value);
    }
    cloneInstance() {
        return new FixedCol(this.id);
    }
    cloneUpdate(source) {
        super.cloneUpdate(source);
        this.definition = source.definition;
    }
    operatorEqAirValue() {
        return new IntValue(0);
    }
    eval(options) {
        if (options && typeof options.evaluateRow !== 'undefined') {
            let row = Number(options.evaluateRow);
            if (this.rowOffset) {
                const rowOffset = this.rowOffset.getValue();
                row += rowOffset; 
            }
            return this.getValueItem(row);
        }
        return this.clone();
    }
    printRowsFrom(offset, count) {
        this.definition.printRowsFrom(offset, count);
    }
    copyRowsFrom(src, src_offset, dst_offset, count) {
        this.definition.copyRowsFrom(src, src_offset, dst_offset, count);
    }
    fillRowsFrom(value, offset, count) {
        this.definition.fillRowsFrom(value, offset, count);
    }
    // printRowsFrom(offset, count) {
    //     if (offset < 0 || count < 0) {
    //         throw new Error('Invalid copy parameters');
    //     }
    //     if (offset + count > this.getValues().length) {
    //         throw new Error('Source range exceeds source length');
    //     }
    //     let _values = [];
    //     for (let index = 0n; index < count; index++) {
    //         const value = this.getValue(offset + index);
    //         _values.push(value);
    //     }
    //     // TODO: use println sytle, common code 
    //     const source = Context.config.printlnLines ? '['+Context.sourceTag+'] ':'';
    //     const spaces = Context.scope.getInstanceType() === 'proof' ? '': '  ';
    //     console.log(`\x1B[36m${spaces}> ${source}[${offset}..${offset+count-1n}] ${_values.join(' ')}\x1B[0m`);
    // }
    // copyRowsFrom(src, src_offset, dst_offset, count) {
    //     if (src_offset < 0 || dst_offset < 0 || count < 0) {
    //         throw new Error('Invalid copy parameters');
    //     }
    //     if (src_offset + count > src.getValues().length) {
    //         throw new Error('Source range exceeds source length');
    //     }
    //     if (dst_offset + count > this.getValues().length) {
    //         throw new Error('Destination range exceeds destination length');
    //     }
    //     const srcValues = src.getValues();
    //     const dstValues = this.getValues();

    //     // Obtain the Buffer from the ArrayBuffer
    //     const srcBuffer = Buffer.from(srcValues.buffer);
    //     const dstBuffer = Buffer.from(dstValues.buffer);
        
    //     // O si ya tienes un Buffer, usa directamente:
    //     // const srcBuffer = srcValues.buffer; // si srcValues.buffer ya es un Buffer
        
    //     // Copy bytes (convert 64bits index to bytes)
    //     const srcByteOffset = Number(src_offset) * 8;
    //     const dstByteOffset = Number(dst_offset) * 8;
    //     const byteLength = Number(count) * 8;
        
    //     srcBuffer.copy(dstBuffer, dstByteOffset, srcByteOffset, srcByteOffset + byteLength);
    // }
    // fillRowsFrom(value, offset, count) {
    //     if (offset < 0 || count < 0) {
    //         throw new Error('Invalid copy parameters');
    //     }
    //     if (offset + count > this.getValues().length) {
    //         throw new Error('Destination range exceeds destination length');
    //     }
    //     const values = this.getValues();
    //     values.fill(value, Number(offset), Number(offset + count));
    // }
}
