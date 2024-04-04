const util = require('util');
const {assert, assertLog, assertReturnInstanceOf} = require('../assert.js');

module.exports = class TranslationTable {
    constructor () {
        this.values = [];
    }
    translate(pos, newPos) {
        this.values[pos] = {newPos, operand: false, purge: false};
    }
    savePurge(pos, operand) {
        this.values[pos] = {newPos: false, operand, purge: true};
    }
    copyPurge(pos, sourcePos) {
        this.values[pos] = {...this.values[sourcePos], purge: true};
    }
    getTranslation(pos) {
        if (typeof this.values[pos] === 'undefined') {
            return false;
        }
        return this.values[pos].newPos;
    }
    getSaved(pos) {
        if (typeof this.values[pos] === 'undefined' || this.values[pos].operand === false) {
            this.dump();
            throw new Error(`Accessing to non-saved value on position ${pos}`);
        }
        return this.values[pos].operand;
    }
    getPurge(pos) {
        if (typeof this.values[pos] === 'undefined') {
            return false;
        }
        return this.values[pos].purge;
    }
    dump(title, expression) {
        console.log(title ?? 'TranslationTable');
        for (let i = this.values.length-1; i >= 0; --i) {
            const extra = expression ? expression.stringStackPos(i) : '';
            console.log(`T ${i} => ${this.values[i] ? this.values[i].newPos : '·'} ${(this.values[i] && this.values[i].purge)?'(P)':''}`.padEnd(17)+extra)
        }
    }
}