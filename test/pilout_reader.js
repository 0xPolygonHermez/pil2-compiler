const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');

// Helpers to compile a .pil and read the generated pilout back, for the specs
// that check what reaches the pilout (symbols, airs, constraints) instead of
// what the compiler evaluates.

const COMPILER = path.join(__dirname, '..', 'src', 'pil.js');
const TMP_DIR = path.join(__dirname, '..', 'tmp');
const PROTO = path.join(__dirname, '..', 'src', 'pilout.proto');

// SymbolType of pilout.proto
const SYMBOL_TYPE = { IM_COL: 0, FIXED_COL: 1, PERIODIC_COL: 2, WITNESS_COL: 3, PROOF_VALUE: 4,
                      AIR_GROUP_VALUE: 5, PUBLIC_VALUE: 6, PUBLIC_TABLE: 7, CHALLENGE: 8,
                      AIR_VALUE: 9, CUSTOM_COL: 10 };

function fixture(name) {
    return path.join(__dirname, 'features', name);
}

// compile pilFile into tmp/<outputName>.pilout, returning its path. The pilout
// name is forced with -n so that the same .pil compiled to different files
// produces the same bytes. Throws with the compiler output on failure.
function compile(pilFile, outputName, options = [], piloutName = outputName) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const pilout = path.join(TMP_DIR, `${outputName}.pilout`);
    try {
        execFileSync(process.execPath, [COMPILER, pilFile, '-o', pilout, '-n', piloutName, ...options],
                     { encoding: 'utf8' });
    } catch (error) {
        throw new Error(`compiling ${pilFile} failed:\n${(error.stdout || '') + (error.stderr || '')}`);
    }
    return pilout;
}

// the output of a compilation that must succeed, to check what the compiler reports
function compileOutput(pilFile, outputName, options = []) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const pilout = path.join(TMP_DIR, `${outputName}.pilout`);
    const output = execFileSync(process.execPath, [COMPILER, pilFile, '-o', pilout, '-n', outputName, ...options],
                                { encoding: 'utf8' });
    return output.replace(/\x1B\[[0-9;]*m/g, '');
}

// the compiler output of a compilation that must fail
function compileError(pilFile, outputName, options = []) {
    try {
        compile(pilFile, outputName, options);
    } catch (error) {
        return error.message;
    }
    throw new Error(`compiling ${pilFile} was expected to fail, but it succeeded`);
}

// write a .pil on tmp, to keep a source that only exists to check one error
// message next to the spec that checks it
function writePil(name, source) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const pilFile = path.join(TMP_DIR, `${name}.pil`);
    fs.writeFileSync(pilFile, source);
    return pilFile;
}

function load(piloutFile) {
    const PilOut = protobuf.loadSync(PROTO).lookupType('PilOut');
    return PilOut.toObject(PilOut.decode(fs.readFileSync(piloutFile)));
}

// an air plus the ids it's located by, the Air message doesn't carry them
function findAir(pilout, airName) {
    for (const [airGroupId, airGroup] of (pilout.airGroups ?? []).entries()) {
        for (const [airId, air] of (airGroup.airs ?? []).entries()) {
            if (air.name === airName) return {air, airId, airGroupId};
        }
    }
    throw new Error(`air ${airName} not found on the pilout`);
}

// [name, id, lengths] of the symbols of one type of an air, on declaration order
function airSymbols(pilout, {airId, airGroupId}, type) {
    return (pilout.symbols ?? [])
        .filter(symbol => (symbol.type ?? 0) === type &&
                          (symbol.airId ?? 0) === airId && (symbol.airGroupId ?? 0) === airGroupId)
        .map(symbol => [symbol.name, symbol.id ?? 0, symbol.lengths ?? []]);
}

// [air, constraint] of every constraint reported by -O output-constraints on raw format, where
// the columns are named by their declaration instead of by the name used to write them
function rawConstraints(output) {
    return [...output.matchAll(/Constraint #\d+ \[AIR:(\w+)\] \(RAW\) > (.*?) === 0 \(/g)]
        .map(match => [match[1], match[2]]);
}

module.exports = { SYMBOL_TYPE, TMP_DIR, fixture, compile, compileOutput, compileError, writePil, load,
                   findAir, airSymbols, rawConstraints };
