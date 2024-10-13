

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


module.exports = class ZFieldSequenceDecoder {
    constructor (Fr, config = {}) {
        this.Fr = Fr;
        this.lastRead = false;
        this.lastWrite = false;
        this.writeCount = 0;
        this.dindex = 0;
        this.data = config.data ?? [];
        this._read = config.read ?? this.defaultRead;
        this._write = config.write ?? function () {};
        this._copy = config.copy ?? function () {};
    }
    defaultRead() {
        return this.data[this.dindex++] ?? false;
    }
    read() {
        this.lastRead = this._read();
        return this.lastRead;
    }
    readIfZero(value) {
        if (value) return value;
        return this.read();
    }
    write(value, times = 1) {
        this.lastWrite = value;
        this.writeCount += times;
        this._write(value, times);
    }
    copy(last, count) {
        this.writeCount += count;
        this._copy(last, count);
    }
    getWriteCount() {
        return this.writeCount;
    }
    getLastRead() {
        return this.lastRead;
    }
    getLastWrite() {
        return this.lastWrite;
    }
    decode() {
        while (this.decodeTag() !== false);
    }
    decodeTag() {
        const tag = this.read();
        if (tag === false) return false;

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

                    case 0x04:  // GEOMETRIC_SEQUENCE
                        return this.decodeTagGeometricSequence();

                    default:    // RESERVED
                }
                break;
            case 0x01:  // ARITHMETIC_INC_SEQUENCE
                return this.decodeTagArithmeticSequence(false);

            case 0x02:  // ARITHMETIC_DEC_SEQUENCE
                return this.decodeTagArithmeticSequence(true);

            case 0x04:  // PUT_0
                return this.decodeTagPut01(0);
            case 0x05:  // PUT_1
                return this.decodeTagPut01(1);

            case 0x06:  // PUT
            case 0x07:  // PUT
                return this.decodeTagPut();
            default:    // RESERVED
        }
    }
    decodeTagRepeatLast() {
        const count = this.read();
        this.write(this.getLastWrite(), count);
    }
    decodeTagRepeatAll() {
        const count = this.read();
        this.copy(this.getWriteCount(), count);
    }
    decodeTagRepeat() {
        const last = this.read();
        const count = this.read();
        this.copy(last, count);
    }
    decodeTagGeometricSequence() {
        const from = this.Fr.e(this.read());
        const count = this.read();
        const ratio = this.Fr.e(this.read());
        const times = this.read();

        for (let index = 0; index < count; ++index) {
            this.write(from, times);
            from = this.Fr.mul(from, ratio);
        }
    }
    decodeTagArithmeticSequence(negateDelta = false) {
        const tag = this.getLastRead();
        const from = this.Fr.e(this.read());
        const count = this.read();
        const _delta = this.readIfZero(tag & TAG_FROM_TO_DELTA_MASK) >> TAG_FROM_TO_DELTA_SBIT;
        const delta = negateDelta ? this.Fr.neg(_delta) : this.Fr.e(_delta);
        const times = this.readIfZero(tag & TAG_TIMES_MASK);

        for (let index = 0; index < count; ++index) {
            this.write(from, times);
            from = this.Fr.add(from, delta);
        }
    }
    decodeTagPut() {
        const tag = this.getLastRead();
        const count = this.readIfZero((tag & TAG_PUT_COUNT_MASK) >> TAG_PUT_COUNT_SBIT);
        const times = this.readIfZero(tag & TAG_TIMES_MASK);
        for (let i = 0; i < count; ++i) {
            this.write(this.read(), times);
        }
    }
    decodeTagPut01(value) {
        const tag = this.getLastRead();
        const times = this.readIfZero(tag & TAG_PUT01_TIMES_MASK);
        this.write(value, times);
    }
}
