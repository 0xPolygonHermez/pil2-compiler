const { assert } = require('chai');
const { fixture, compile, load, findAir, domainNames, constraintDomains, domains } = require('./pilout_reader.js');

// Domains are declared inside an airtemplate, so each air of the pilout carries
// its own list and its constraints reference them by the index on that list.

describe('Domains are packed per air', () => {
    let pilout, firstLast, cycles;

    before(() => {
        pilout = load(compile(fixture('domain_multi.pil'), 'domain_multi'));
        firstLast = findAir(pilout, 'FirstLast');
        cycles = findAir(pilout, 'Cycles');
    });

    it('indexes the domains of each air from 0', () => {
        assert.deepEqual(domainNames(pilout, firstLast), ['FirstLast.FIRST', 'FirstLast.LAST']);
        assert.deepEqual(domainNames(pilout, cycles),
                         ['Cycles.LIMITS_16', 'Cycles.ODD', 'Cycles.QUARTER', 'Cycles.WHOLE']);
    });

    it("doesn't pack a domain that no constraint uses", () => {
        assert.notInclude(domainNames(pilout, firstLast), 'FirstLast.UNUSED');
        assert.equal((firstLast.air.domains ?? []).length, 2);
    });

    it('turns each declared sequence into its cycle and offsets', () => {
        assert.deepEqual(domains(pilout, firstLast), {
            'FirstLast.FIRST': {cycleBits: 8, offsets: [0]},        // [1,0...]
            'FirstLast.LAST': {cycleBits: 8, offsets: [255]},       // [0...,1]
        });
        const cyclesDomains = domains(pilout, cycles);
        assert.deepEqual(cyclesDomains['Cycles.LIMITS_16'], {cycleBits: 4, offsets: [0, 15]});
        assert.deepEqual(cyclesDomains['Cycles.ODD'], {cycleBits: 1, offsets: [1]});
        assert.deepEqual(cyclesDomains['Cycles.QUARTER'], {cycleBits: 2, offsets: [0, 1]});
        // WHOLE = [1...] selects every row, one offset per row
        assert.equal(cyclesDomains['Cycles.WHOLE'].cycleBits, 8);
        assert.equal(cyclesDomains['Cycles.WHOLE'].offsets.length, 256);
    });

    it('groups the constraints of each air by its own domains', () => {
        assert.deepEqual(constraintDomains(pilout, firstLast), [
            [false, 24],                    // a * b === 0
            ['FirstLast.FIRST', 17],        // a === 0 domain FIRST
            ['!FirstLast.FIRST', 21],       // inside domain !FIRST { ... }
            ['FirstLast.LAST', 18],         // b === 1 domain LAST
        ]);
        assert.deepEqual(constraintDomains(pilout, cycles), [
            [false, 52],                    // x - y === 0
            ['Cycles.LIMITS_16', 5],        // created by boolean(x) inside the domain block
            ['Cycles.ODD', 41],             // x === y domain ODD
            ['!Cycles.ODD', 49],            // y <== x * x domain !ODD
            ['Cycles.QUARTER', 45],         // inside a plain scope of the domain block
            ['Cycles.WHOLE', 51],           // x + y === 1 domain WHOLE
        ]);
    });

    it('gives its domain to a constraint created inside a called function', () => {
        // boolean(x) is called from a domain LIMITS_16 block, the constraint it
        // creates belongs to that domain even if the function knows nothing about it
        const fromFunction = constraintDomains(pilout, cycles).filter(([, line]) => line === 5);
        assert.deepEqual(fromFunction, [['Cycles.LIMITS_16', 5]]);
    });

    it('keeps the witness hint of a <== constraint with a domain', () => {
        assert.deepEqual((pilout.hints ?? []).map(hint => hint.name), ['witness_calc']);
    });
});
