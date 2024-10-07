const Expression = require("../expression.js");
const Debug = require('../debug.js');
const assert = require('../assert.js');
const Context = require('../context.js');
const SequenceBase = require('./base.js');

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
    }
    tag(data, index) {
        const tag = data[index];
        if (tag & 0x80) {
            throw new Error(`Invalid tag 0x${tag.toString(16)}(${tag}) on index ${index}`);
        }
        const htag = tag >> 4;
        switch(htag) {
            case 0x00:  // REPEAT_LAST, REPEAT_ALL, REPEAT, FROM_TO_GEOM
                switch(tag & 0x0F) {
                    case 0x01:  // REPEAT_LAST
                        return this.decodeTagRepeatLast();

                    case 0x02:  // REPEAT_ALL
                        return this.decodeTagRepeatAll();

                    case 0x03:  // REPEAT
                        return this.decodeTagRepeat();

                    case 0x04:  // FROM_TO_GEOM
                        return this.decodeTagFromToGeom();

                    default:    // RESERVED
                }
                break;
            case 0x01:  // FROM_TO
                return this.decodeTagFromTo();

            case 0x04:  // PUT_0
                return this.decodeTagPut0();
            case 0x05:  // PUT_1
                return this.decodeTagPut1();

            case 0x06:  // PUT
            case 0x07:  // PUT
                return this.decodeTagPut(data, index);
            default:    // RESERVED
        }
    }
    decodeTagPut(data, index) {
        const tag = data[index];
        let times = (tag & TAG_TIMES_MASK);
        let count = (tag & TAG_PUT_COUNT_MASK) >> TAG_PUT_COUNT_SBIT;
        if (!count) {
           count = data[index++];
        }
        if (!times) {
           times = data[index++];
        }
        for (let i = 0; i < count; ++i) {
            this.decodeWrite(data[index++], times);
        }
        return index;
    }
    decodeTagPut(data, index) {
        const tag = data[index];
        let times = (tag & TAG_TIMES_MASK);
        let count = (tag & TAG_PUT_COUNT_MASK) >> TAG_PUT_COUNT_SBIT;
        if (!count) {
           count = data[index++];
        }
        if (!times) {
           times = data[index++];
        }
        for (let i = 0; i < count; ++i) {
            this.decodeWrite(data[index++], times);
        }
        return index;
    }

    tagFromToGeom(from, to, ratio, times) {
        return this.flushStack([`#tagFromToGeom(${from},${to},${ratio},${times})`, TAG_FROM_TO_GEOM, from, to, ratio, times]);
    }
    tagRepeat(last, elements) {
        if (last === 1) {
            return this.flushStack([`#tagRepeat(last)(${last},${elements})`, TAG_REPEAT_LAST, elements]);
        }
        return this.flushStack([`#tagRepeat(${last},${elements})`, TAG_REPEAT, last, elements]);
    }
    tagPut(values, times = 1) {
        let code = [TAG_PUT];

        // check if value 0,1
        const first = values[0];
        let debug = `#tagPut([${values.join(',')}],${times})`;
        if (values.length == 1 && (first == 0n || first == 1n)) {
            code[0] = first ? TAG_PUT_1 : TAG_PUT_0;
            let count = 1;
            // count how many consecutive ones or zeros there are
            while (count < values.length && values[count] == first) ++count;
            // compress count
            const total = count * times;
            if (total > 0n && total < 16n ) {
                code[0] += total;
            } else {
                code.push(total);
            }
            debug += '=>@compress01('+first.toString()+','+total+')=0x'+code[0].toString(16)+'+...';
            code.unshift(debug);

            // check if remaing values
            if (count == values.length) {
                return code;
            }
            // if remaining values, concat
            return code.concat(this.tagPut(values.slice(count), times));
        }

        // could not compress 0/1, check if compress count
        const count = values.length;
        if (count > 0n || count < 16n ) {
            code[0] += count * 2;
        } else {
            code.push(count);
        }
        // compress times
        if (times == 1n) {
            code[0] |= TAG_TIMES_ONE;
        } else {
            code.push(times);
        }
        // concat values
        code.unshift(debug);
        return code.concat(values);
    }
    tagFromTo(from, to, delta, times) {
        let code = this.flushStack([TAG_FROM_TO, from, to]);
        if (delta > 0n || delta < 8n ) {
            code[0] += Number(delta) * 2;
        } else {
            code.push(delta);
        }
        if (times == 1n) {
            code[0] |= TAG_TIMES_ONE;
        } else {
            code.push(times);
        }
        code.unshift(`#tagFromTo(${from},${to},${delta},${times})`);
        return code;
    }

    beginExecution() {
        this.pos = 0;
    }
    endExecution(res) {
        if (this.#stack.length === 0) {
            return res;
        }
        return [res[0].concat(this.flushStack()), res[1]];
    }
    flushStack(code = []) {
        let _code = [];
        while (this.#stack.length > 0) {
            const times = this.#stack[0][1];
            let count = 1;
            let plen = this.#stack.length - 1;
            // group all stack values with same times
            while (count < this.#stack.length && this.#stack[count][1] == times) ++count;
            _code = _code.concat(this.tagPut(this.#stack.slice(0, count).map(x => x[0]), times));
            this.#stack.splice(0, count);
        }
        return _code.concat(code);
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
            return [this.tagFromToGeom(fromValue, toValue, delta, times), count];
        }
        return [this.tagFromTo(fromValue, toValue, delta, times), count];
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
        let code = [];
        for(const value of e.values) {
            const [_code, _count] = this.insideExecute(value);
            count += _count;
            code = code.concat(_code);
        }
        return [code, count];
    }
    sequence(e) {
        return this.seqList(e);
    }
    paddingSeq(e) {
        // TODO: if last element it's a padding, not need to fill and after when access to
        // a position applies an module over index.
        const [code, seqSize] = this.insideExecute(e.value);
        let remaingValues = this.paddingSize - seqSize;
        if (remaingValues < 0) {
            throw new Error(`In padding range must be space at least for one time sequence [paddingSize(${this.paddingSize}) - seqSize(${seqSize}) = ${remaingValues}] at ${this.debug}`);
        }
        if (seqSize < 1) {
            throw new Error(`Sequence must be at least one element at ${this.debug}`);
        }
        if (remaingValues === 0) {
            return [code, seqSize];
        }
        return [code.concat(remaingValues > 0 ? this.tagRepeat(seqSize, remaingValues): []),
                seqSize + remaingValues];
    }
    #pushElement(value, times = 1) {
        this.#stack.push([value, times]);
    }
    #repeatLastStackElement(times) {
        const top = this.#stack.length - 1;
        let [value, count] = this.#stack[top];
        this.#stack[top][1] = count + times;
    }
    expr(e) {
        this.#pushElement(this.e2num(e));
        return [[], 1];
    }
    repeatSeq(e) {
        const times = Number(this.e2num(e.times));
        const [_code, _count] = this.insideExecute(e.value);
        if (times === 1) {
            return [_code, _count];
        }
        if (this.#stack.length > 0 || _count == 1) {
            console.log('times', times);
            this.#repeatLastStackElement(times - 1);
            return [_code, times];
        } else {
            const code = _code.concat(this.tagRepeat(_count, (times-1) * _count));
            const count = _count * times;
            return [code, count];
        }
    }
}