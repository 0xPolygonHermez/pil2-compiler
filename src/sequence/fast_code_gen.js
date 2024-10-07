const Expression = require("../expression.js");
const Debug = require('../debug.js');
const assert = require('../assert.js');
const Context = require('../context.js');
const SequenceBase = require('./base.js');

module.exports = class SequenceFastCodeGen extends SequenceBase {
    fromTo(fromValue, toValue, delta, times, operation = '+') {
        let count = 0;
        if (toValue === false) {
            toValue = this.calculateToValue(fromValue, delta, times, operation);
            count = this.paddingSize;
        } else {
            count = this.calculateSingleCount(fromValue, toValue, delta, operation);
        }
        count = times * count;
        const v = this.createCodeVariable('_v');
        const comparator = ((operation === '+' || operation === '*') && delta > 0n) ? '<=':'>=';
        let code = `for(let ${v}=${fromValue}n;${v}${comparator}${toValue}n;${v}=${v}${delta > 0n? operation+delta:delta}n){`;
        code += '__data[__dindex++] = ' + (this.bytes === 8 ? `Fr.e(${v})` : `Number(${v})`) + ';';
        if (times > 1) {
            const _code = this.#getCodeRepeatLastElements(1, times - 1);
            code += _code;
        }
        code += '}\n';
        return [code, count];
    }

    rangeSeq(e) {
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        const delta = fromValue > toValue ? -1n:1n;
        return this.fromTo(fromValue, toValue, delta, times);
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
        let code = e.values.length > 1 ? '{' : '';
        for(const value of e.values) {
            const [_code, _count] = this.insideExecute(value);
            count += _count;
            code += _code;
        }
        return [code + (e.values.length > 1 ? '}' : ''), count];
    }
    sequence(e) {
        return this.seqList(e);
    }
    paddingSeq(e) {
        // TODO: if last element it's a padding, not need to fill and after when access to
        // a position applies an module over index.
        const [_code, seqSize] = this.insideExecute(e.value);
        let remaingValues = this.paddingSize - seqSize;
        if (remaingValues < 0) {
            throw new Error(`In padding range must be space at least for one time sequence [paddingSize(${this.paddingSize}) - seqSize(${seqSize}) = ${remaingValues}] at ${this.debug}`);
        }
        if (seqSize < 1) {
            throw new Error(`Sequence must be at least one element at ${this.debug}`);
        }
        if (remaingValues === 0) {
            return [_code, seqSize];
        }
        let code = `{${_code}`;
        if (remaingValues > 0) {
            const v1 = this.createCodeVariable();
            const base = this.createCodeVariable('_b');
            code += this.#getCodeRepeatLastElements(seqSize, remaingValues);
        }
        code += '}\n';
        return [code, seqSize + remaingValues];
    }
    expr(e) {
        // no cache
        const num = Context.Fr.e(this.e2num(e));
        const type = this.bytes === 8 ? 'n' :''
        return [`__data[__dindex++] = ${num}${type};\n`, 1];
    }
    createCodeVariable(prefix = '_i') {
        const index = (this.varIndex ?? 0) + 1;
        this.varIndex = index;
        return prefix + index;
    }
    byBytes(value) {
        if (this.bytes === 1) return value;
        return `(${value}) * ${this.bytes}`
    }
    #getCodeRepeatLastElements(count, rlen) {
        // count is the number of elements sequence to repeat
        // rlen is the number of elements to repeteat (ex: rlen = count * times)
        // data.fill(data.slice(3, 9), 9, 9 + 50000 * 6);
        if (this.bytes === 1) {
            return `__dbuf.fill(__dbuf.slice(__dindex - ${count}, __dindex), __dindex, __dindex + ${rlen}); __dindex += ${rlen};`;
        }
        return `__dbuf.fill(__dbuf.slice((__dindex - ${count})*${this.bytes}, __dindex*${this.bytes}),`+
               ` __dindex*${this.bytes}, (__dindex + ${rlen})*${this.bytes}); __dindex += ${rlen}*${this.bytes};`;
    }
    repeatSeq(e) {
        // TODO, review cache problems.
        // if (!e.__cache) {
        const times = Number(this.e2num(e.times));
        const [_code, _count] = this.insideExecute(e.value);
        if (times === 1) {
            return [_code, _count];
        }
        const v = this.createCodeVariable();
        const code = '{' + _code +';'+this.#getCodeRepeatLastElements(_count, (times-1) * _count) + '}';
        const count = _count * times;
        return [code, count];
        //     e.__cache = [code, count];
        // }
        // return e.__cache;
    }
    genContext() {
        let __dbuf = Buffer.alloc(this.size * this.bytes)
        let context = {__dbuf, __dindex: 0, Fr: Context.Fr};
        switch (this.bytes) {
            case 1: context.__data = new Uint8Array(__dbuf.buffer, 0, this.size); break;
            case 2: context.__data = new Uint16Array(__dbuf.buffer, 0, this.size); break;
            case 4: context.__data = new Uint32Array(__dbuf.buffer, 0, this.size); break;
            case 8: context.__data = new BigInt64Array(__dbuf.buffer, 0, this.size); break;
        }
        return context;
    }
}