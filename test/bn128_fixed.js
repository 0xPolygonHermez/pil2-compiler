const { assert } = require('chai');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');

// A field larger than 64 bits (the scalar field of BN128, selected with --field bn128) puts values of more
// than 64 bits in the pilout: the base field itself, every negative constant and most fixed values. This spec
// compiles the same pil on Goldilocks and on BN128 and reads the fixed columns back from the pilout.

const GOLDILOCKS = 0xffffffff00000001n;
const BN128 = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const N = 16;

const PIL = path.join(__dirname, 'bn128', 'big_fixed.pil');
const TMP = path.join(__dirname, '..', 'tmp');

// Compiles `pil` into tmp/<name>.pilout, with --field `field` unless it is false. Returns the pilout's
// path and the compiler's output.
function compilePil(pil, name, field, extraArgs = []) {
    const compiler = path.join(__dirname, '..', 'src', 'pil.js');
    const pilout = path.join(TMP, `${name}.pilout`);
    const args = [compiler, pil, '-o', pilout, ...extraArgs];
    fs.mkdirSync(TMP, { recursive: true });
    if (field !== false) {
        args.push('--field', field);
    }
    const output = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' });
    return { pilout, output };
}

// Compiles big_fixed.pil into tmp/<name>.pilout, with --field `field` unless it is false.
function compile(name, field, extraArgs = []) {
    return compilePil(PIL, name, field, extraArgs).pilout;
}

// The output of a compilation that must fail.
function failure(name, args) {
    try {
        compile(name, false, args);
    } catch (error) {
        return (error.stdout || '') + (error.stderr || '');
    }
    assert.fail(`${name} compiled`);
}

function loadPilout(filename) {
    const proto = path.join(__dirname, '..', 'src', 'pilout.proto');
    const PilOut = protobuf.loadSync(proto).lookupType('PilOut');
    return PilOut.decode(fs.readFileSync(filename));
}

function buf2bint(buf) {
    let value = 0n;
    for (const byte of buf) value = (value << 8n) | BigInt(byte);
    return value;
}

function expectedColumns(p) {
    const fe = (x) => ((x % p) + p) % p;
    const rows = [...Array(N).keys()].map(BigInt);
    let geo = 1n;
    return {
        GEO: rows.map(() => { const value = geo; geo = fe(geo * (p - 2n)); return value; }),
        LST: rows.map((i) => (i % 2n ? 7n : p - 1n)),
        NEG: rows.map((i) => (i % 2n ? 7n : p - 1n)),
        ARI: rows.map((i) => fe(-i)),
        ROW: rows.map((i) => p - 1n - i),
        FILL: rows.map((i) => (i < BigInt(N / 2) ? p - 1n : 3n)),
        FILL_RESIZE: rows.map((i) => (i === 0n ? p - 1n : 3n)),
        COPY: rows.map((i) => p - 1n - i),
    };
}

// Values of a binary fixed file, each one as `limbs` little-endian 64-bit limbs. fixed-to-file interleaves the
// columns row by row; a fixed_dump holds a single column.
function readLimbs(filename, limbs) {
    const words = new BigUint64Array(new Uint8Array(fs.readFileSync(filename)).buffer);
    const values = [];
    for (let index = 0; index < words.length; index += limbs) {
        let value = 0n;
        for (let limb = limbs - 1; limb >= 0; --limb) value = (value << 64n) | words[index + limb];
        values.push(value);
    }
    return values;
}

// Writes an extern fixed file ("cnst") with the column <air>.<name>, each value as `limbs` little-endian
// 64-bit limbs.
function writeExternFixedFile(filename, air, name, values, limbs) {
    const str = (s) => Buffer.from(`${s}\0`, 'latin1');
    const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
    const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
    const words = new BigUint64Array(values.length * limbs);
    for (let index = 0; index < words.length; ++index) {
        words[index] = values[Math.floor(index / limbs)] >> (64n * BigInt(index % limbs));
    }
    const body = Buffer.concat([str(air), str(air), u64(values.length), u32(1), str(`${air}.${name}`), u32(0), Buffer.from(words.buffer)]);
    fs.writeFileSync(filename, Buffer.concat([Buffer.from('cnst\x01\0\0\0\x01\0\0\0\x01\0\0\0', 'latin1'), u64(body.length), body]));
}

function fixedColumns(pilout) {
    const air = pilout.airGroups[0].airs[0];
    const columns = {};
    for (const symbol of pilout.symbols) {
        if (symbol.type !== 1 /* FIXED_COL */) continue;
        const name = symbol.name.split('.').pop();
        columns[name] = air.fixedCols[symbol.id].values.map(buf2bint);
    }
    return columns;
}

// limbs: 64-bit limbs of a field element in the binary fixed files
for (const [fieldName, field, p, limbs] of [['Goldilocks', false, GOLDILOCKS, 1], ['BN128', 'bn128', BN128, 4]]) {
    describe(`Fixed values of more than 64 bits on ${fieldName}`, function () {
        this.timeout(120000);

        let pilout;
        before(() => {
            pilout = loadPilout(compile(`big_fixed_${fieldName.toLowerCase()}`, field));
        });

        it('stores the base field', () => {
            assert.strictEqual(buf2bint(pilout.baseField), p);
        });

        const expected = expectedColumns(p);
        for (const name of Object.keys(expected)) {
            it(`stores ${name}`, () => {
                const columns = fixedColumns(pilout);
                assert.property(columns, name);
                assert.deepEqual(columns[name], expected[name]);
            });
        }

        it('writes the same values with fixed-to-file', () => {
            const dir = path.join(TMP, `big_fixed_${fieldName.toLowerCase()}_fixed`);
            const symbols = loadPilout(compile(`big_fixed_${fieldName.toLowerCase()}_fixed_to_file`, field, ['-O', 'fixed-to-file', '-u', dir]))
                .symbols.filter((symbol) => symbol.type === 1 /* FIXED_COL */);
            const values = readLimbs(path.join(dir, 'BigFixed.fixed'), limbs);
            for (const symbol of symbols) {
                const column = values.filter((_, index) => index % symbols.length === symbol.id);
                assert.deepEqual(column, expected[symbol.name.split('.').pop()]);
            }
        });

        it('loads an extern fixed file and dumps columns with fixed_dump', () => {
            const dir = path.join(TMP, `extern_fixed_${fieldName.toLowerCase()}`);
            fs.mkdirSync(dir, { recursive: true });
            writeExternFixedFile(path.join(dir, 'extern.bin'), 'ExternFixed', 'E', expected.ROW, limbs);
            const pil = path.join(dir, 'extern_fixed.pil');
            fs.writeFileSync(pil, [
                `airtemplate ExternFixed(int N = ${N}) {`,
                '    #pragma extern_fixed_file "extern.bin"',
                '    col fixed E;',
                `    #pragma fixed_dump ExternFixed.E ${path.join(dir, 'E.bin')}`,
                '    col fixed S = [0, -1..+..];',
                `    #pragma fixed_dump ExternFixed.S ${path.join(dir, 'S.bin')}`,
                '    col witness W;',
                '    W * (E + S) === 0;',
                '}',
                'airgroup ExternFixed { ExternFixed(); }',
            ].join('\n'));
            const columns = fixedColumns(loadPilout(compilePil(pil, `extern_fixed_${fieldName.toLowerCase()}`, field).pilout));
            assert.deepEqual(columns.E, expected.ROW);
            assert.deepEqual(readLimbs(path.join(dir, 'E.bin'), limbs), expected.ROW);
            assert.deepEqual(readLimbs(path.join(dir, 'S.bin'), limbs), expected.ARI);
        });
    });
}

// fixed_bytes_field.pil: BIG, sized by "#pragma fixed_bytes field", stores the same values as PLAIN and never
// resizes; only PLAIN resizes, on a field larger than 64 bits, and its warning suggests the pragma.
for (const [fieldName, field] of [['Goldilocks', 'goldilocks'], ['BN128', 'bn128']]) {
    describe(`#pragma fixed_bytes field on ${fieldName}`, function () {
        this.timeout(120000);

        let output;
        let columns;
        before(() => {
            let pilout;
            ({ pilout, output } = compilePil(path.join(__dirname, 'bn128', 'fixed_bytes_field.pil'), `fixed_bytes_field_${field}`, field));
            columns = fixedColumns(loadPilout(pilout));
        });

        it('stores the same values as without the pragma', () => {
            assert.deepEqual(columns.BIG, columns.PLAIN);
        });

        it('only resizes the column without the pragma, suggesting it', () => {
            const suggestions = output.match(/use #pragma fixed_bytes \S+/g) ?? [];
            assert.deepEqual(suggestions, field === 'bn128' ? ['use #pragma fixed_bytes field'] : []);
        });
    });
}

describe('--field', function () {
    this.timeout(120000);

    it('takes goldilocks, the default, by name', () => {
        assert.strictEqual(buf2bint(loadPilout(compile('field_goldilocks', 'goldilocks')).baseField), GOLDILOCKS);
    });

    it('refuses an unknown field, naming the known ones', () => {
        assert.include(failure('field_unknown', ['--field', 'bn256']), 'unknown field "bn256": use goldilocks, bn128');
    });
});
