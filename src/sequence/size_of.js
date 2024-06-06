const Expression = require("../expression.js");
const Debug = require('../debug.js');
const assert = require('../assert.js');
const Context = require('../context.js');
const SequenceBase = require('./base.js');

module.exports = class SequenceSizeOf extends SequenceBase {
    seqList(e) {
        let size = 0;
        for(const value of e.values) {
            size += this.execute(value);
        }
        return size
    }
    sequence(e) {
        return this.seqList(e);
    }
    repeatSeq(e) {
        const times = this.toNumber(Context.processor.getExprNumber(e.times));
        if (Debug.active) console.log(['times', times]);
        return times  * this.execute(e.value);
    }
    paddingSeq(e) {
        const size = this.execute(e.value);
        return this.parent.setPaddingSize(size);
    }
    rangeSeq(e) {
        // TODO review if negative, fe?
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        return this.toNumber(toValue > fromValue ? toValue - fromValue + 1n : toValue - fromValue + 1n) *  times;
    }
    arithSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        const delta = t2 - t1;
        if (tn !== false) {
            const distance = tn - t2;
            if ((delta > 0 && tn < t2) || (delta < 0 && tn > t2) || (distance % delta !== 0n)) {
                throw new Error(`Invalid terms of arithmetic sequence ${t1},${t2}...${tn} at ${this.debug}`);
            }
            return this.toNumber(distance/delta + 2n) * times;
        }
        else {
            return this.paddingSize = 2;
        }
        // TODO review if negative, fe?
    }
    geomSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 === 0n) {
            throw new Error(`Invalid terms of geometric sequence ${t1},${t2}...${tn} at ${this.debug}`);
        }
        const [count, reverse, ti, tf, ratio] = this.getGeomInfo(t1, t2, tn, times, true);
        return tn === false ? count : count * times;
    }
    expr(e) {
        return 1;
    }
}