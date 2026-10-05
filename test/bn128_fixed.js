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

// Compiles big_fixed.pil into tmp/<name>.pilout, with --field `field` unless it is false.
function compile(name, field, extraArgs = []) {
    const compiler = path.join(__dirname, '..', 'src', 'pil.js');
    const pilout = path.join(TMP, `${name}.pilout`);
    const args = [compiler, PIL, '-o', pilout, ...extraArgs];
    fs.mkdirSync(TMP, { recursive: true });
    if (field !== false) {
        args.push('--field', field);
    }
    execFileSync(process.execPath, args, { encoding: 'utf8', stdio: 'pipe' });
    return pilout;
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

for (const [fieldName, field, p] of [['Goldilocks', false, GOLDILOCKS], ['BN128', 'bn128', BN128]]) {
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
    });
}

describe('fixed-to-file on a field larger than 64 bits', function () {
    this.timeout(120000);

    it('fails instead of truncating the values', () => {
        let output = '';
        try {
            compile('big_fixed_bn128_fixed_to_file', 'bn128', ['-O', 'fixed-to-file', '-u', path.join(TMP, 'big_fixed_bn128_fixed')]);
        } catch (error) {
            output = (error.stdout || '') + (error.stderr || '');
        }
        assert.include(output, 'fixed-to-file only supports fields of 64 bits or less');
    });
});

describe('--field', function () {
    this.timeout(120000);

    it('takes goldilocks, the default, by name', () => {
        assert.strictEqual(buf2bint(loadPilout(compile('field_goldilocks', 'goldilocks')).baseField), GOLDILOCKS);
    });

    it('refuses an unknown field, naming the known ones', () => {
        assert.include(failure('field_unknown', ['--field', 'bn256']), 'unknown field "bn256": use goldilocks, bn128');
    });

    it('refuses a config that sets the prime', () => {
        const config = path.join(TMP, 'field_config_prime.json');
        fs.writeFileSync(config, JSON.stringify({ prime: BN128.toString() }));
        assert.include(failure('field_config_prime', ['-P', config]), "the config's prime is not read: choose the field with --field");
    });
});
