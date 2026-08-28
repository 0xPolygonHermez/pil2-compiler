const { assert } = require('chai');
const { fixture, compile, load, findAir, domainNames, constraintDomains, domains } = require('./pilout_reader.js');

// Domains are row selectors attached to constraints, either one by one
// (`expr === expr domain NAME`) or by blocks (`domain NAME { ... }`), and
// optionally on their complement (`domain !NAME`). They only show up on the
// generated pilout, so this spec compiles the fixture and reads it back.

describe('Domain constraints reach the pilout grouped by domain', () => {
    let pilout, located, air;

    before(() => {
        pilout = load(compile(fixture('domain.pil'), 'domain'));
        located = findAir(pilout, 'DomainAir');
        air = located.air;
    });

    it('names the domains used by some constraint on the symbols', () => {
        assert.equal((air.domains ?? []).length, 2);
        assert.deepEqual(domainNames(pilout, located), ['DomainAir.LIMITS_16', 'DomainAir.FIRST']);
    });

    it('stores the cycle as its log2 and the offsets it selects', () => {
        assert.deepEqual(domains(pilout, located), {
            // LIMITS_16 = [1,0:14,1], a 16 rows cycle selecting its first and last row
            'DomainAir.LIMITS_16': {cycleBits: 4, offsets: [0, 15]},
            // FIRST = [1,0...], extended to the whole air
            'DomainAir.FIRST': {cycleBits: 8, offsets: [0]},
        });
    });

    it('groups the constraints by domain, the ones without domain first', () => {
        assert.deepEqual(constraintDomains(pilout, located), [
            [false, 33],                     // a * enable === b * sel
            ['DomainAir.LIMITS_16', 12],     // sel * (1 - sel) === 0 domain LIMITS_16
            ['DomainAir.LIMITS_16', 16],     // inside domain LIMITS_16 { ... }
            ['DomainAir.LIMITS_16', 22],     // after the nested domain FIRST block
            ['!DomainAir.LIMITS_16', 26],    // a * (1 - a) === 0 domain !LIMITS_16
            ['DomainAir.FIRST', 20],         // inside the nested domain FIRST block
            ['!DomainAir.FIRST', 29],        // inside the domain !FIRST block
        ]);
    });
});
