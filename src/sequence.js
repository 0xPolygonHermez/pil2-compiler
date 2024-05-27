const Router = require("./router.js");
const Expression = require("./expression.js");
const Values = require('./values.js');
const Debug = require('./debug.js');
const vm = require('vm');
const assert = require('./assert.js');

const MAX_ELEMS_GEOMETRIC_SEQUENCE = 300;
class SequencePadding {
    constructor (value, size) {
        this.value = value;
        this.size = size;
    }
}
module.exports = class Sequence {
    #values;

    static cacheGeomN = [];
    // TODO: Review compiler estructures
    // TODO: iterator of values without "extend"
    // TODO: check repetitive sequences (times must be same)
    // TODO: check arith_seq/geom_seq with repetitive

    constructor (parent, expression, maxSize) {
        this.parent = parent;
        this.#values = new Values();
        this.padding = false;
        this.expression = expression;
        this.router = new Router(this, 'type', {pre: this.preRoute});

        this.maxSize = typeof maxSize === 'undefined' ? false : Number(maxSize);
        this.paddingCycleSize = false;
        this.paddingSize = 0;
        this.extendPos = 0;
        this.debug = '';
        this.valueCounter = 0;
        this.varIndex = 0;
        this.sizeOf(expression);
    }
    clone() {
        let cloned = new Sequence(this.parent, this.expression, this.maxSize);
        if (Debug.active) console.log(['CLONED', this.maxSize, cloned.maxSize]);
        this.#values.mutable = false;
        cloned.#values = this.#values.clone();
        return cloned;
    }
    preRoute(method, e) {
        if (e.debug) this.debug = e.debug;
    }
    getValue(index) {
        return this.#values.getValue(index);
    }
    #setValue(index, value) {
        ++this.valueCounter;
        return this.#values.__setValue(index, value);
    }
    setValue(index, value) {
        if ((index >= 0 && (this.maxSize === false || index < this.maxSize) === false)) {
            console.log(`\x1B[33mERROR Invalid value of extendPos:${index} maxSize:${this.maxSize}  ${this.debug}\x1B[0m`);
        }
        if (typeof this.#values.getValue(index) !== 'undefined') {
            console.log(`\x1B[33mERROR Rewrite index position:${index} ${this.debug}\x1B[0m`);
        }
        ++this.valueCounter;
        return this.#values.setValue(index, value);
    }
    sizeOf(e) {
        this.paddingCycleSize = false;
        this.paddingSize = 0;
        const size = this._sizeOf(e);
        assert.ok(size >= this.paddingCycleSize, `size(${size}) < paddingCycleSize(${this.paddingCycleSize})`);
        if (Debug.active) {
            console.log(['SIZE(MAXSIZE)', this.maxSize]);
            console.log(['SIZE(paddingCycleSize)', this.paddingCycleSize]);
            console.log(['SIZE(paddingSize)', this.paddingSize]);
        }
        if (this.paddingCycleSize) {
            this.paddingSize = this.maxSize - (size - this.paddingCycleSize);
            this.size = size - this.paddingCycleSize + this.paddingSize;
        } else {
            this.size = size;
        }
        if (Debug.active) console.log(['SIZE', this.size]);
        return this.size;
    }
    _sizeOf(e) {
        if (e instanceof Expression) return 1;
        switch (e.type) {
            case 'sequence': return this._sizeOfSequence(e);
            case 'padding_seq': return this._sizeOfPaddingSeq(e);
            case 'seq_list': return this._sizeOfSeqList(e);
            case 'repeat_seq': return this._sizeOfRepeatSeq(e);
            case 'range_seq': return this._sizeOfRangeSeq(e);
            case 'arith_seq': return this._sizeOfArithSeq(e);
            case 'geom_seq': return this._sizeOfGeomSeq(e);
        }
        throw new Error(`Invalid sequence type ${e.type} sizeof`);
    }
    _sizeOfSeqList(e) {
        let size = 0;
        for(const value of e.values) {
            size += this._sizeOf(value);
        }
        return size
    }
    _sizeOfSequence(e) {
        return this._sizeOfSeqList(e);
    }
    _sizeOfRepeatSeq(e) {
        const times = this.toNumber(this.parent.getExprNumber(e.times));
        if (Debug.active) console.log(['times', times]);
        return times  * this._sizeOf(e.value);
    }
    setPaddingSize(size) {
        if (this.maxSize === false) {
            throw new Error(`Invalid padding sequence without maxSize at ${this.debug}`);
        }
        if (this.paddingCycleSize !== false) {
            throw new Error(`Invalid padding sequence, previous padding sequence already has been specified at ${this.debug}`);
        }
        this.paddingCycleSize = size;
        return this.paddingCycleSize;
    }
    _sizeOfPaddingSeq(e) {
        const size = this._sizeOf(e.value);
        return this.setPaddingSize(size);
    }
    getRangeSeqInfo(e) {
        const fromTimes = e.times ? this.toNumber(this.e2num(e.times)): 1;
        const toTimes = e.toTimes ? this.toNumber(this.e2num(e.toTimes)): fromTimes;
        if (Debug.active) console.log(['fromTimes', fromTimes, 'toTimes', toTimes]);
        if (fromTimes !== toTimes) {
            throw new Error(`In range sequence, from(${fromTimes}) and to(${toTimes}) must be same`);
        }
        return [this.e2num(e.from), this.e2num(e.to), fromTimes];
    }
    getTermSeqInfo(e) {
        if (e._cache_getTermSeqInfo) return e._cache_getTermSeqInfo;

        const t1Times = e.t1.times ? this.toNumber(this.e2num(e.t1.times)): 1;
        const t2Times = e.t2.times ? this.toNumber(this.e2num(e.t2.times)): 1;
        const tnTimes = e.tn.times === false ? false : (e.tn.times ? this.toNumber(this.e2num(e.t2.times)): 1);
        if (Debug.active) console.log(['t1Times', t1Times, 't2Times', t2Times, 'tnTimes', tnTimes]);
        if (t1Times !== t2Times && (tnTimes === false || tnTimes === t2Times)) {
            throw new Error(`In term sequence, t1(${t1Times}), t2(${t2Times})`+
                        (tnTimes === false ? '':` and tn(${tbTimes}`)+'must be same');
        }
        // console.log(e);
        const t1 = this.e2num(e.t1 instanceof Expression ? e.t1 : e.t1.value);
        const t2 = this.e2num(e.t2 instanceof Expression ? e.t2 : e.t2.value);
        const tn = e.tn === false ? false : this.e2num(e.tn instanceof Expression ? e.tn : e.tn.value);
        if (t1 === t2) {
            throw new Error(`In term sequence, t1(${t1}), t2(${t2}) must be different`);
        }
        e._cache_getTermSeqInfo = [t1, t2, tn, t1Times];
        return e._cache_getTermSeqInfo;
    }
    _sizeOfRangeSeq(e) {
        // TODO review if negative, fe?
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        return this.toNumber(toValue > fromValue ? toValue - fromValue + 1n : toValue - fromValue + 1n) *  times;
    }
    _sizeOfArithSeq(e) {
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
            return this.setPaddingSize(2);
        }
        // TODO review if negative, fe?
    }
    _extendArithSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        const delta = t2 - t1;
        /* console.log({tag: 'XXXX-', t1, t2, delta, tn, paddingSize: this.paddingSize});
        const tfinal = tn === false ? t1 + delta * BigInt(this.paddingSize): tn + delta;
        console.log({tag: 'XXXXX', tn, tfinal, paddingSize: this.paddingSize});
        let value = t1;*/
        const count = tn === false ? this.paddingSize : times * (this.toNumber(((tn - t1) / delta)) + 1);
        const finalExtendPos = this.extendPos + count;
        // console.log({t1, t2, delta, tn, extendPos: this.extendPos, count, finalExtendPos, paddingSize: this.paddingSize});
        let value = t1;
        while (this.extendPos < finalExtendPos) {
            for (let itimes = 0; itimes < times && this.extendPos < finalExtendPos; ++itimes) {
                this.#setValue(this.extendPos++,value);
            }
            value = value + delta;
        }
        return count;
    }
    calculateGeomN(ratio, ti, tf) {
        const ratioAsNum = this.toNumber(ratio);
        const rn = tf/ti;

        if (rn <= Number.MAX_SAFE_INTEGER) {
            return BigInt(Math.round(Math.log(this.toNumber(rn))/Math.log(ratioAsNum)));
        }

        const key = [ratio, rn].join('_');
        let res = Sequence.cacheGeomN[key];
        if (typeof res !== 'undefined') {
            return res;
        }

        // Path if rn is too big to use Math.log
        let n = BigInt(Math.floor(Math.log(Number.MAX_SAFE_INTEGER)/Math.log(ratioAsNum)));

        let value = rn;
        let chunks = [n];
        let chunkValue = ratio ** n;
        let chunkValues = [chunkValue];
        while (chunkValue < rn) {
            chunkValue = chunkValue * chunkValue;
            n = n * 2n;
            chunkValues.push(chunkValue);
            chunks.push(n);
        }
        n = 0n;
        for (let index = chunks.lenght - 2; index >= 0; --index) {
            if (value < chunkValues[index]) continue;
            value = value / chunkValues[index];
            n = n + chunks[index];
        }
        n = n + BigInt(Math.round(Math.log(this.toNumber(value))/Math.log(ratioAsNum)));
        Sequence.cacheGeomN[key] = n;
        return n;
    }
    getGeomInfo(t1, t2, tn, times, calculateSize = false) {
        // TODO: negative values ?
        const reverse = t1 > t2;
        const ratio = reverse ? t1/t2 : t2/t1;

        if ((reverse ? t2:t1) === 0n) {
            // console.log({tf, ti, mod:tf % ti, reverse, t1, t2, tn});
            return [false, false, false, false, false];
        }

        let n = 0;
        let padding = tn === false;
        if (padding) {
            if (calculateSize) {
                return [this.setPaddingSize(2), reverse, 0n, 0n, ratio];
            }
            n = BigInt(Math.floor(this.paddingSize / times));
            if (!reverse) {
                tn = t1 * (ratio ** n);
            } else {
                // console.log({tn, t1, ratio, n, paddingSize: this.paddingSize});
                tn = t1 / (ratio ** n);
                if (tn === 0n) {
                    throw new Error(`Invalid geometric sequence must specify last element, implicit last element is < 1 ${this.debug}`)
                }
            }
        }
        // console.log({calculateSize, n});
        // TODO: review case tn !== false and reverse
        const tf = reverse ? t1 : tn;
        const ti = reverse ? tn : t1;
        if ((reverse && tn > t2) || (!reverse && tn < t2)) {
            return [false, false, false, false, false];
        }
        if (n == 0) {
            n = this.calculateGeomN(ratio, ti, tf);
            // console.log({_: 'calculateGeomN', n, ratio, ti, tf});
        }
        if (tf !== (ti * (ratio ** BigInt(n)))) {
            throw new Error(`ERROR geometric seq calculation ${tf} !== ${ti} * (${ratio} ** ${BigInt(n)})`);
        }
        return [this.toNumber(n) + 1, reverse, ti, tf, ratio];
    }
    _sizeOfGeomSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 === 0n) {
            throw new Error(`Invalid terms of geometric sequence ${t1},${t2}...${tn} at ${this.debug}`);
        }
        const [count, reverse, ti, tf, ratio] = this.getGeomInfo(t1, t2, tn, times, true);
        return tn === false ? count : count * times;
    }
    _extendGeomSeq(e) {        
        const [t1, t2, _tn, times] = this.getTermSeqInfo(e);
        const [_count, reverse, ti, tf, ratio] = this.getGeomInfo(t1, t2, _tn, times);

        const padding = _tn === false;
        const tn = padding ? t1 * (ratio ** BigInt(this.paddingSize - 1)) : _tn;
        let value = ti;
        const count = padding ? this.paddingSize : _count * times;
        this.extendPos = this.extendPos + (reverse ? (count - 1):0);
        const initialPos = this.extendPos;

        let itimes = reverse && padding && count % times ? count % times :times;
        // console.log({t1,t2,_tn,times,_count, count, value, reverse, ti, tf, ratio, paddingSize: this.paddingSize,
        //             extendPos: this.extendPos, itimes});
        let remaingValues = count;
        while (remaingValues > 0) {
            while (remaingValues > 0 && itimes > 0)  {
                --remaingValues;
                --itimes;
                this.#setValue(this.extendPos, value);
                this.extendPos = this.extendPos + (reverse ? -1:1);
            }
            itimes = times;
            value = value * ratio;
        }
        if (reverse) {
            this.extendPos = initialPos + 1;
        }
        // console.log({tn, _tn, _count, count});
        return count;
    }
    _extendRangeSeq(e) {
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        return this.extendRangeSeq(fromValue, toValue, times, fromValue > toValue ? -1n:1n);
    }
    extendRangeSeq(fromValue, toValue, times, delta = 1n, ratio = 1n) {
        const initialExtendPos = this.extendPos;
        let value = fromValue;
        assert.ok(times > 0);
        while (value <= toValue) {
            for (let itimes = 0; itimes < times; ++itimes) {
                this.#setValue(this.extendPos++, value);
            }
            value = (value + delta) * ratio;
        }
        return this.extendPos - initialExtendPos;
    }
    geomCount(fromValue, toValue, delta) {
        if (delta < Number.MIN_SAFE_INTEGER || delta > Number.MAX_SAFE_INTEGER) {
            throw new Error(`Geometric coeficient to big ${delta}`);
        }
        if (!fromValue || !toValue || !delta) {
            throw new Error(`Invalid geometric parameters from:${fromValue} to:${toValue} delta:${delta}`);
        }

        const _delta = Number(delta);
        if (fromValue >= Number.MIN_SAFE_INTEGER && fromValue <= Number.MAX_SAFE_INTEGER && 
            toValue >= Number.MIN_SAFE_INTEGER && toValue <= Number.MAX_SAFE_INTEGER) {
            console.log({fromValue, toValue, delta, _delta});
            if (toValue > fromValue) {
                assert.ok(Number(toValue/fromValue) > 0);
                return Math.floor(Math.log(Number(toValue/fromValue))/Math.log(_delta)) + 1;
            } 
            assert.ok(Number(fromValue/toValue) > 0);
            return Math.floor(Math.log(Number(fromValue/toValue))/Math.log(_delta)) + 1;
        }                
        const _maxToValue = delta ** BigInt(Math.floor(Math.log(Number.MAX_SAFE_INTEGER)/Math.log(_delta)));
        const _times = fromValue / BigInt(_maxToValue);
        assert.ok((_times * 54n) <= Number.MAX_SAFE_INTEGER);
        let count = Number(fromValue / BigInt(_maxToValue)) * this.geomCount(1, _maxToValue, _delta);
        const _remainToValue = Number(fromValue % BigInt(_maxToValue));
        if (_remainToValue) {
            count += this.geomCount(1, _remainToValue, _delta);
        }
        return count;       
    }
    calculateToValue(fromValue, delta, times, operation) {
        const size = Math.ceil(this.paddingSize / times);
        switch (operation) {
            case '+': return fromValue + BigInt(size - 1) * delta;
            case '-': return fromValue - BigInt(size - 1) * delta;
            case '*': return fromValue * (delta ** BigInt(size - 1));
            case '/': return fromValue / (delta ** BigInt(size - 1));
        }
        throw new Error(`Invalid sequence operation ${operation}`);            
    }
    calculateSingleCount(fromValue, toValue, delta, operation) {
        switch (operation) {
            case '+': return Number((toValue - fromValue) / delta) + 1; 
            case '-': return Number((fromValue - toValue) / delta) + 1; 
            case '*': return this.geomCount(fromValue, toValue, delta);
            case '/': return this.geomCount(fromValue, toValue, delta);
        }
        throw new Error(`Invalid sequence operation ${operation}`);
    }
    _gcodeFromTo(fromValue, toValue, delta, times, operation = '+') {
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
        if (times === 1) {
            code += `__values.push(${v});}\n`;
        } else {
            const v2 = this.createCodeVariable();
            code += `for(let ${v2}=0;${v2}<${times};++${v2}){__values.push(${v})}}\n;`;
        }
        return [code, count];
    }

    _gcodeRangeSeq(e) {
        const [fromValue, toValue, times] = this.getRangeSeqInfo(e);
        const delta = fromValue > toValue ? -1n:1n;
        return this._gcodeFromTo(fromValue, toValue, delta, times);
    }
    _gcodeArithSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 === t2) {
            throw new Error(`Invalid arithmetic parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
        }
        if (t1 > t2) {
            return this._gcodeFromTo(t1, tn, t1-t2, times, '-');
        }
        return this._gcodeFromTo(t1, tn, t2-t1, times, '+');
    }
    _gcodeGeomSeq(e) {
        const [t1, t2, tn, times] = this.getTermSeqInfo(e);
        if (t1 > t2) {
            if (t1 % t2) {
                throw new Error(`Invalid geometric parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
            }
            return this._gcodeFromTo(t1, tn, t1/t2, times, '/');
        }
        if (t2 % t1) {
            throw new Error(`Invalid geometric parameters t1:${t1} t2:${t2} tn:${tn} times:${times}`);
        }
        return this._gcodeFromTo(t1, tn, t2/t1, times, '*');
    }

    extend() {
        if (Debug.active) console.log(this.size);
        this.extendPos = 0;
        const [code, count] = this._gcode(this.expression);
        let __values = [];
        const context = {__values}
        vm.createContext(context);
        vm.runInContext(code, context);
        this.#values.__setValues(__values);
        this.#values.mutable = false;
    }
    verify() {
        if (!assert.isEnabled) return;

        if (Debug.active) {
            console.log(this.toString());
            console.log([this.extendPos, this.size]);
            console.log(['SIZE', this.size]);
        }
        assert.strictEqual(this.valueCounter, this.size);
        for (let index = 0; index < size; ++index) {
            assert.typeOf(this.values[index], 'bigint', `type of index ${index} not bigint (${typeof this.values[index]}) ${value}`);
        }
    }
    _extend(e) {
        if (e instanceof Expression) {
            return this._extendExpr(e);
        }
        switch (e.type) {
            case 'sequence': return this._extendSequence(e);
            case 'padding_seq': return this._extendPaddingSeq(e);
            case 'seq_list': return this._extendSeqList(e);
            case 'repeat_seq': return this._extendRepeatSeq(e);
            case 'range_seq': return this._extendRangeSeq(e);
            case 'arith_seq': return this._extendArithSeq(e);
            case 'geom_seq': return this._extendGeomSeq(e);
        }
        throw new Error(`Invalid sequence type ${e.type} extend`);
    }
    _gcode(e) {
        if (e instanceof Expression) {
            return this._gcodeExpr(e);
        }
        switch (e.type) {
            case 'sequence': return this._gcodeSequence(e);
            case 'padding_seq': return this._gcodePaddingSeq(e);
            case 'seq_list': return this._gcodeSeqList(e);
            case 'repeat_seq': return this._gcodeRepeatSeq(e);
            case 'range_seq': return this._gcodeRangeSeq(e);
            case 'arith_seq': return this._gcodeArithSeq(e);
            case 'geom_seq': return this._gcodeGeomSeq(e);
        }
        throw new Error(`Invalid sequence type ${e.type} gcode`);
    }
    _extendSeqList(e) {
        let count = 0;
        for(const value of e.values) {
            count += this._extend(value);
        }
        return count;
    }
    _gcodeSeqList(e) {
        let count = 0;
        let code = e.values.length > 1 ? '{' : '';
        for(const value of e.values) {
            const [_code, _count] = this._gcode(value);
            count += _count;
            code += _code;
        }
        return [code + (e.values.length > 1 ? '}' : ''), count];
    }
    _extendSequence(e) {
        return this._extendSeqList(e);
    }
    _gcodeSequence(e) {
        return this._gcodeSeqList(e);
    }
    _extendPaddingSeq(e) {        
        let from = this.extendPos;
        let seqSize = this._extend(e.value);
        let remaingValues = this.paddingSize - seqSize;
        if (remaingValues < 0) {
            throw new Error(`In padding range must be space at least for one time sequence at ${this.debug}`);
        }
        if (seqSize < 1) {
            console.log(e.value);
            throw new Error(`Sequence must be at least one element at ${this.debug}`);
        }
        // console.log('SETTING REMAING_VALUES '+remaingValues+' '+seqSize);
        // console.log({remaingValues, seqSize});
        while (remaingValues > 0) {
            let upto = remaingValues >= seqSize ? seqSize : remaingValues;
            // console.log(`SETTING UPTO ${upto} ${remaingValues} ${seqSize}`);
            for (let index = 0; index < upto; ++index) {
                this.#setValue(this.extendPos++, this.#values.getValue(from + index));
            }
            remaingValues = remaingValues - upto;
        }
        return this.paddingSize;
    }
    _gcodePaddingSeq(e) {        
        // TODO: if last element it's a padding, not need to fill and after when access to
        // a position applies an module over index.
        const [_code, seqSize] = this._gcode(e.value);        
        let remaingValues = this.paddingSize - seqSize;
        if (remaingValues < 0) {
            throw new Error(`In padding range must be space at least for one time sequence [paddingSize(${this.paddingSize}) - seqSize(${seqSize}) = ${remaingValues}] at ${this.debug}`);
        }
        if (seqSize < 1) {
            throw new Error(`Sequence must be at least one element at ${this.debug}`);
        }
        if (remaingValues === 0) {
            return [_code. seqSize];
        }
        let code = `{${_code}`;
        if (remaingValues > 0) {
            const v1 = this.createCodeVariable();
            const base = this.createCodeVariable('_b');
            code += `let ${base}=__values.length-${seqSize};for (let ${v1}=0;${v1}<${remaingValues};++${v1}){__values.push(__values[${base}+${v1}]);}`;
        }
        code += '}\n';
        return [code, seqSize + remaingValues];
    }
    _extendExpr(e) {        
        const num = this.e2num(e);
        this._values[this.extendPos++] = num;
        return 1;
    }
    _gcodeExpr(e) {        
        // no cache
        const num = this.e2num(e);
        return [`__values.push(${num}n);\n`, 1];
    }
    createCodeVariable(prefix = '_i') {
        return prefix+(++this.varIndex);
    }
    _extendRepeatSeq(e) {
        let count = 0;
        const times = this.e2num(e.times);
        for (let itime = 0; itime < times; ++itime) {
            count += this._extend(e.value);
        }
        return count;
    }
    _gcodeRepeatSeq(e) {
        if (!e.__cache) {
            const times = this.e2num(e.times);
            const [_code, _count] = this._gcode(e.value);
            const v = this.createCodeVariable();
            const code = `for (let ${v}=0;${v}<${times};++${v}){${_code}}`;
            const count = _count * Number(times);
            e.__cache = [code, count];
        }
        return e.__cache;
    }
    e2num(e) {
        if (typeof e === 'bigint' || typeof e === 'number') {
            return e;
        }
        return this.parent.getExprNumber(e);
    }
/*
    reserve(count, label, multiarray, data) {
        this.variables[this.lastId] = { count, type: data.type, values:[] };
        return this.lastId++;
    }
    get(id, offset) {
        console.log([id, offset,this.variables[id]]);
    }
    getTypedValue(id, offset) {
        const vdata = this.variables[id]
        return {type: vdata.type, value: vdata.values[offset] };
    } */
    toString() {
        return this.#values.toString();
    }
    toNumber(value) {
        if (Debug.active) console.log(value);
        let nvalue = Number(value);
        if (nvalue === NaN || isNaN(nvalue)) {
            throw new Error(`Invalid number ${value}`);
        }
        return nvalue;
    }
}