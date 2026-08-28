const { assert } = require('chai');
const { compile, compileError, writePil, load, findAir, constraintDomains } = require('./pilout_reader.js');

// A domain has to be a 0/1 selector over a cycle that is a power of two, it only
// lives inside an air, and it only exists on the pilout version 2. These specs
// check every one of those controls, and that the legacy version is still
// generated when no domain is involved.

function air(body, name = 'A') {
    return `airtemplate ${name}(int N = 2**8) {\n    col witness a;\n    col witness b;\n${body}\n}\n`
         + `airgroup G { ${name}(); }\n`;
}

describe('Domain declaration controls', () => {

    it('refuses a cycle that is not a power of two', () => {
        const pil = writePil('domain_bad_cycle', air(`
            domain BAD = [1,0,0,1,0];
            a === 0 domain BAD;`));
        assert.match(compileError(pil, 'domain_bad_cycle'),
                     /Domain A\.BAD has a cycle of 5 rows, but it must be a power of 2/);
    });

    it('refuses a value that is not 0 or 1', () => {
        const pil = writePil('domain_bad_value', air(`
            domain BAD = [1,0:14,2];
            a === 0 domain BAD;`));
        assert.match(compileError(pil, 'domain_bad_value'),
                     /Domain A\.BAD has the value 2 on row 15, but only 0 or 1 are allowed/);
    });

    it("refuses a domain that doesn't select any row", () => {
        const pil = writePil('domain_empty', air(`
            domain EMPTY = [0,0:14,0];
            a === 0 domain EMPTY;`));
        assert.match(compileError(pil, 'domain_empty'), /Domain A\.EMPTY doesn't select any row/);
    });

    it('refuses a domain declared out of an airtemplate', () => {
        const pil = writePil('domain_out_of_air', 'domain D = [1,0...];\n' + air('    a === 0;'));
        assert.match(compileError(pil, 'domain_out_of_air'),
                     /domain D must be declared inside airtemplate/);
    });
});

describe('Domain use controls', () => {

    it('refuses an unknown domain', () => {
        const pil = writePil('domain_unknown', air('    a === 0 domain NOPE;'));
        assert.match(compileError(pil, 'domain_unknown'), /domain NOPE not found/);
    });

    it('refuses a name that was declared as something else', () => {
        const pil = writePil('domain_not_a_domain', air('    a === 0 domain b;'));
        assert.match(compileError(pil, 'domain_not_a_domain'),
                     /b was defined as witness, but used as domain/);
    });

    it('refuses a domain block out of an airtemplate', () => {
        const pil = writePil('domain_block_on_proof', 'proofval pv;\n'
            + air(`
            domain FIRST = [1,0...];
            a === 0 domain FIRST;`)
            + 'domain FIRST {\n    pv * (1 - pv) === 0;\n}\n');
        assert.match(compileError(pil, 'domain_block_on_proof'),
                     /domain FIRST block only could be used inside airtemplate, not on proof scope/);
    });

    it('refuses a domain on a global constraint', () => {
        const pil = writePil('domain_on_global', 'proofval pv;\n'
            + air(`
            domain FIRST = [1,0...];
            a === 0 domain FIRST;`)
            + 'pv * (1 - pv) === 0 domain FIRST;\n');
        assert.match(compileError(pil, 'domain_on_global'),
                     /Global constraint could not be attached to domain FIRST/);
    });
});

describe('Pilout version', () => {
    const noDomains = air('    a * (1 - a) === 0;\n    a === b;');

    it('refuses to generate a domain on the legacy version', () => {
        const pil = writePil('domain_legacy', air(`
            domain FIRST = [1,0...];
            a === 0 domain FIRST;`));
        assert.match(compileError(pil, 'domain_legacy', ['-O', 'pilout-version=1']),
                     /Domain constraints are available from pilout version 2, but version 1 was requested/);
    });

    it('refuses an unknown version', () => {
        const pil = writePil('domain_version_3', noDomains);
        assert.match(compileError(pil, 'domain_version_3', ['-O', 'pilout-version=3']),
                     /Invalid pilout version 3, valid versions are 1, 2/);
    });

    it('generates the legacy constraints when no domain is used', () => {
        const pil = writePil('version_1', noDomains);
        const pilout = load(compile(pil, 'version_1', ['-O', 'pilout-version=1']), 1);
        const constraints = findAir(pilout, 'A').air.constraints;
        assert.deepEqual(constraints.map(constraint => Object.keys(constraint)[0]),
                         ['everyRow', 'everyRow']);
    });

    it('is 2 by default, where those constraints are the ones of every row', () => {
        const pilout = load(compile(writePil('version_2', noDomains), 'version_2'));
        const located = findAir(pilout, 'A');
        assert.deepEqual(located.air.constraints.map(constraint => Object.keys(constraint)[0]),
                         ['allRows', 'allRows']);
        assert.deepEqual(constraintDomains(pilout, located).map(([domain]) => domain), [false, false]);
    });
});
