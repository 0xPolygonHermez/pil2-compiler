

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
const TAG_ARITHMETIC_INC_SEQUENCE = 0x10;
const TAG_ARITHMETIC_DEC_SEQUENCE = 0x20;
const TAG_PUT = 0x60;
const TAG_PUT_COUNT_MASK = 0x1E;
const TAG_PUT_COUNT_SBIT = 1;
const TAG_REPEAT_LAST = 0x01;
const TAG_REPEAT_ALL = 0x02;
const TAG_REPEAT = 0x02;
const TAG_GEOMETRIC_SEQUENCE = 0x03;
const TAG_PUT_0 = 0x40;
const TAG_PUT_1 = 0x50;
const TAG_FROM_TO_DELTA_MASK = 0x0E;
const TAG_FROM_TO_DELTA_SBIT = 1;
module.exports = class ZFieldSequenceEncoder {
    #stack;
    constructor (Fr, options = {}) {
        this.Fr = Fr;
        this.options = options;
        this.debug = false;
        this.#stack = [];
        this.short = options.short ?? false;
    }
    encodeTagGeometricSequence(from, count, ratio, times) {
        return this.flushStack([TAG_GEOMETRIC_SEQUENCE, from, count, ratio, times], '#tagGeometricSequence');
    }
    encodeTagRepeat(last, elements) {
        if (last === 1) {
            return this.flushStack([TAG_REPEAT_LAST, elements], '#tagRepeat(last)');
        }
        return this.flushStack([TAG_REPEAT, last, elements], '#tagRepeat');
    }
    encodeTagPut(values, times = 1) {
        let code = [TAG_PUT];

        // check if value 0,1
        const first = values[0];
        let _debug = this.debug ? '#tagPut([' + values.join(',') +'],' + times + ')':'';
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
            if (this.debug) {
                _debug += '=>@compress01('+first.toString()+','+total+')=0x'+code[0].toString(16)+'+...';
                code.unshift(debug);
            }

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
        if (this.debug) {
            code.unshift(_debug);
        }
        // concat values
        return code.concat(values);
    }
    encodeTagArithmeticSequence(from, count, delta, times) {
        const _from = this.Fr.e(from);
        const decSequence = (delta < 0);
        const _delta = this.Fr.e(decSequence ? -delta:delta);
        let code = this.flushStack([decSequence ? TAG_ARITHMETIC_INC_SEQUENCE : TAG_ARITHMETIC_DEC_SEQUENCE, from, count]);
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
        if (this.debug) {
            code.unshift(`#tagArith${decSequence?'Dec':'Inc'}Sequence(${from},${count},${delta},${times})`);
        }
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
    flushStack(code = [], _debug = false) {
        let _code = [];
        if (this.debug && _debug !== false) {
            _code.push(_debug + '(' + code.slice(1).concat(',') +')');
        }
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
    #pushElement(value, times = 1) {
        this.#stack.push([value, times]);
    }
}
