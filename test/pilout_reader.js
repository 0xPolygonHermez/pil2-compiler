const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');

// Helpers to compile a .pil and read the generated pilout back. Domains (and the
// row selection of a constraint in general) only exist on the pilout, so the
// specs about them compile the fixture and inspect the result.

const COMPILER = path.join(__dirname, '..', 'src', 'pil.js');
const TMP_DIR = path.join(__dirname, '..', 'tmp');

const SYMBOL_TYPE_DOMAIN = 11;

// pilout version => .proto that defines it
const PROTO_BY_VERSION = {
    1: path.join(__dirname, '..', 'src', 'pilout_1.proto'),
    2: path.join(__dirname, '..', 'src', 'pilout.proto'),
};

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

function load(piloutFile, version = 2) {
    const PilOut = protobuf.loadSync(PROTO_BY_VERSION[version]).lookupType('PilOut');
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

// names of the domains of an air, by their index on air.domains: the Domain
// structure doesn't carry the name, it's on the symbols
function domainNames(pilout, {airId, airGroupId}) {
    let names = [];
    for (const symbol of pilout.symbols ?? []) {
        if (symbol.type !== SYMBOL_TYPE_DOMAIN) continue;
        if ((symbol.airId ?? 0) !== airId || (symbol.airGroupId ?? 0) !== airGroupId) continue;
        names[symbol.id ?? 0] = symbol.name;
    }
    return names;
}

// [domain name, source line] of each constraint of an air, on packing order. The
// domain is false when the constraint applies to every row, and it's prefixed
// with ! when the constraint applies to the complement of the domain.
function constraintDomains(pilout, located) {
    const names = domainNames(pilout, located);
    return (located.air.constraints ?? []).map(constraint => {
        const kind = ['allRows', 'domainRows', 'complementDomainRows'].find(k => constraint[k]);
        const body = constraint[kind];
        const line = Number(body.debugLine.match(/:(\d+)/)[1]);
        const domain = kind === 'allRows' ? false
                     : (kind === 'complementDomainRows' ? '!' : '') + names[body.domainIdx ?? 0];
        return [domain, line];
    });
}

// {name: {cycleBits, offsets}} of the domains packed on an air
function domains(pilout, located) {
    const names = domainNames(pilout, located);
    let res = {};
    for (const [index, domain] of (located.air.domains ?? []).entries()) {
        res[names[index]] = {cycleBits: domain.cycleBits ?? 0, offsets: domain.offsets ?? []};
    }
    return res;
}

module.exports = { SYMBOL_TYPE_DOMAIN, TMP_DIR, fixture, compile, compileError, writePil, load,
                   findAir, domainNames, constraintDomains, domains };
