const Expression = require("../expression.js");
const Debug = require('../debug.js');
const assert = require('../assert.js');
const Context = require('../context.js');
const SequenceBase = require('./base.js');

module.exports = class SequenceSizeOf extends SequenceBase {
    seqList(e) {
        let size = 0;
        for(const value of e.values) {
            size += this.insideExecute(value);
        }
        return size
    }
    sequence(e) {
        if (!this.maxValue) this.maxValue = 0n;
        return this.seqList(e);
    }
    repeatSeq(e) {
        const times = this.toNumber(Context.processor.getExprNumber(e.times));
        if (Debug.active) console.log(['times', times]);
        return times  * this.insideExecute(e.value);
    }
    paddingSeq(e) {
        const size = this.insideExecute(e.value);
        return this.parent.setPaddingSize(size);
    }
    rangeSeq(e) {
        // TODO review if negative, fe?
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        this.updateMaxValue(fromValue);
        this.updateMaxValue(toValue);
        return this.toNumber(toValue > fromValue ? toValue - fromValue + 1n : toValue - fromValue + 1n) *  times;
    }
    arithSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        const delta = t2 - t1;
        const distance = tn - t2;
        this.updateMaxValue(t1);
        if (tn !== false) {
            if ((delta > 0 && tn < t2) || (delta < 0 && tn > t2) || (distance % delta !== 0n)) {
                throw new Error(`Invalid terms of arithmetic sequence ${t1},${t2}...${tn} at ${this.debug}`);
            }
            this.updateMaxValue(tn);
            return this.toNumber(distance/delta + 2n) * times;
        }
        else {
            this._paddingFrom = t2;
            this._paddingDelta = delta;
            return this.paddingSize = 2;
        }
        // TODO review if negative, fe?
    }
    geomSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        this.updateMaxValue(t1);
        if (t1 === 0n) {
            throw new Error(`Invalid terms of geometric sequence ${t1},${t2}...${tn} at ${this.debug}`);
        }
        const [count, reverse, ti, tf, ratio] = this.getGeomInfo(t1, t2, tn, times, true);
        if (tf !== false) this.updateMaxValue(t1);
        return tn === false ? count : count * times;
    }
    expr(e) {
        this.updateMaxValue(e.asInt());
        return 1;
    }
    updateMaxValue(value) {
        if (value < 0n) {
            value = Context.Fr.e(value);
        }
        if (this.maxValue < value) {
            this.maxValue = value;
        }
    }
    getMaxValue() {
        return this.maxValue;
    }
    getMaxBytes() {
        if (this.maxValue < 256n) return 1;
        if (this.maxValue < 65536n) return 2;
        if (this.maxValue < 4294967296n) return 4;
        if (this.maxValue < 0x10000000000000000n) return 8;
        throw new Error(`too big number ${this.maxValue}`);
    }
    updateMaxSizeWithPadingSize(paddingSize) {
        if (this._paddingDelta) {
            this.updateMaxValue(this._paddingFrom + this._paddingDelta * (paddingSize - 1n));
        }
    }
}