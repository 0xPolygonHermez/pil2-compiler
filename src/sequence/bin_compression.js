const Expression = require("../expression.js");
const Debug = require('../debug.js');
const assert = require('../assert.js');
const Context = require('../context.js');
const SequenceBase = require('./base.js');
const ZSequence = require("../z_sequence.js");
const ZSequenceEncoder = require("../z_sequence/encoder.js");

const MAGIC_TAG = 0x3CA81A73;

const MASK_A =      0b11000000;
const A_PUT =       0b01000000;
const MASK_B =      0b11100000;
const B_FROM_TO =   0b00100000;
const B_SINGLE =    0b00000000;
const MASK_SINGLE = 0b00001111;
const MASK_TIMES =  0b00000001;
const TAG_ZEQ    =  0x5A;
const TAG_LZMA   =  0x4C;

const TAG_TIMES_MASK = 0x01;
const TAG_TIMES_ONE = 0x01;
const TAG_FROM_TO = 0x10;
const TAG_PUT = 0x60;
const TAG_PUT_COUNT_MASK = 0x1E;
const TAG_PUT_COUNT_SBIT = 1;
const TAG_REPEAT_LAST = 0x01;
const TAG_REPEAT_ALL = 0x02;
const TAG_REPEAT = 0x02;
const TAG_FROM_TO_GEOM = 0x03;
const TAG_PUT_0 = 0x40;
const TAG_PUT_1 = 0x50;
const TAG_FROM_TO_DELTA_MASK = 0x0E;
const TAG_FROM_TO_DELTA_SBIT = 1;
/*
    magic 4 bytes: 0x3CA81A73
    uncompressed len (bytes)
    max element size (bytes)
    type compression: 0x00 - no compression
                      0x5A - Zequence
                      0x4Z - Lzma

    code tag in 127 bits to avoid use more than one byte with varlen codification.

    +---+---+---+---+---+---+---+---+
    | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 | BIT
    +---+---+---+---+---+---+---+---+
    | 1 |           x               | FORBIDDEN - NO VALID
    +---+---+---+---+-----------+---+
    |   |   |   |               |   | PUT|[count]|[times]|value_1|...|value_count
    | 0 | 1 | 1 |   [0-15]      | t | n != 0, number of elements (no count argument), n = 0 number of elements on optional argument count
    |   |   |   |               |   | t = 1, without repetitions, only once. t = 0, number of times each element on optional argument times
    +---+---+---+---+-----------+---+
    |   |   |   |   |               | PUT_0|[times]
    | 0 | 1 | 0 | 0 |     [0-15]    | t != 0, t number of "0", t = 0 => number of times of "0"
    +---+---+---+---+---------------+
    |   |   |   |   |               | PUT_1|[times]
    | 0 | 1 | 0 | 1 |     [0-15]    | t != 0, t number of "1", t = 0 => number of times of "1"
    +---+---+-------+-----------+---+
    | 0 | 0 |   0   |       0       | FORBIDDEN - NO VALID
    +---+---+-------+---------------+
    |   |   |       |       1       | 1: REPEAT_LAST|elements_repeated (last=1)
    |   |   |       |       2       | 2: REPEAT_ALL|elements_repeated  (last=current_length)
    | 0 | 0 |   0   |       3       | 3: REPEAT|last|elements_repeated
    |   |   |       |       4       | 4: FROM_TO_GEOM|from|to|ratio|times
    |   |   |       |     [5-15]    | RESERVED
    +---+---+-------+---------------+
    |   |   |       |           |   | FROM_TO|from|to|[delta]|[times]
    | 0 | 0 |   1   |   delta   | t | delta (from < to: delta, from > to: -delta, delta = 0 variable delta)
    |   |   |       |           |   | t = times (0: variable times, 1: times = 1)
    +---+---+-------+-----------+---+
    |   |   |       |               |
    | 0 | 0 | [2-3] |               | RESERVED
    |   |   |       |               |
    +---+---+-------+---------------+
*/

module.exports = class SequenceBinCompression extends SequenceBase {
    #stack;
    constructor (parent, label, options = {}) {
        super(parent, label, options);
        this.#stack = [];
        this.short = options.short ?? false;
        this.encoder = new ZSequenceEncoder();
    }
    fromTo(fromValue, toValue, delta, times, operation = '+') {
        let count = 0;
        if (toValue === false) {
            toValue = this.calculateToValue(fromValue, delta, times, operation);
            count = this.paddingSize;
        } else {
            count = this.calculateSingleCount(fromValue, toValue, delta, operation);
        }
        const isGeometric = operation === '*' || operation === '/';
        count = times * count;
        if (isGeometric) {
            this.encoder.encodeTagGeometricSequence(fromValue, toValue, delta, times);
            return count;
        }
        this.encoder.encodeTagArithmeticSequence(fromValue, toValue, delta, times);
        return count;
    }

    rangeSeq(e) {
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        return this.fromTo(fromValue, toValue, 1n, times);
    }
    arithSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 === t2) {
            throw new Error(`Invalid arithmetic parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
        }
        if (t1 > t2) {
            return this.fromTo(t1, tn, t1-t2, times, '-');
        }
        return this.fromTo(t1, tn, t2-t1, times, '+');
    }
    geomSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 > t2) {
            if (t1 % t2) {
                throw new Error(`Invalid geometric parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
            }
            return this.fromTo(t1, tn, t1/t2, times, '/');
        }
        if (t2 % t1) {
            throw new Error(`Invalid geometric parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
        }
        return this.fromTo(t1, tn, t2/t1, times, '*');
    }
    seqList(e) {
        let count = 0;
        for(const value of e.values) {
            count += this.insideExecute(value);
        }
        return count;
    }
    sequence(e) {
        return this.seqList(e);
    }
    paddingSeq(e) {
        // TODO: if last element it's a padding, not need to fill and after when access to
        // a position applies an module over index.
        const seqSize = this.insideExecute(e.value);
        let remaingValues = this.paddingSize - seqSize;
        if (remaingValues < 0) {
            throw new Error(`In padding range must be space at least for one time sequence [paddingSize(${this.paddingSize}) - seqSize(${seqSize}) = ${remaingValues}] at ${this.debug}`);
        }
        if (seqSize < 1) {
            throw new Error(`Sequence must be at least one element at ${this.debug}`);
        }
        if (remaingValues != 0) {
            this.encoder.encodeTagRepeat(seqSize, remaingValues);
        }
        return seqSize + remaingValues;
    }
    expr(e) {
        this.encoder.encodeTagPut(this.e2num(e));
        return 1;
    }
    repeatSeq(e) {
        const times = Number(this.e2num(e.times));
        let count = this.insideExecute(e.value);
        if (times === 1) {
            return count;
        }
        // repeat times - 1, to do n, put once and repeat n - 1
        this.encoder.encodeTagRepeat(count, (times - 1)* count);
        return count;
    }
}