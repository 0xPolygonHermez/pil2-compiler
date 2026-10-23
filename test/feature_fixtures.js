const { assert } = require('chai');
const { execFileSync } = require('child_process');
const path = require('path');

// Runs `#pragma test` feature files through the CLI in an isolated subprocess
// (the Context is a per-process singleton) and checks the printed assert_eq
// summary.
function runFeature(file, extraArgs = []) {
    const pil = path.join(__dirname, 'features', file);
    const cli = path.join(__dirname, '..', 'src', 'pil.js');
    let out;
    try {
        out = execFileSync(process.execPath, [cli, pil, '-e', '--asserts', ...extraArgs], { encoding: 'utf8' });
    } catch (e) {
        throw new Error('pil2com failed to run:\n' + ((e.stdout || '') + (e.stderr || '')));
    }
    assert.notInclude(out, 'tests FAIL', 'some assert_eq failed:\n' + out);
    assert.include(out, 'All tests passed', 'expected all tests to pass:\n' + out);
}

describe("Feature fixtures", function () {
    this.timeout(120000);

    it("fixed_function_arg.pil: fixed columns as function arguments", () => {
        runFeature('fixed_function_arg.pil');
    });

    it("table_get_value.pil: Tables.get_value", () => {
        runFeature('table_get_value.pil');
    });

    it("table_self_copy.pil: overlapping Tables.copy on Goldilocks", () => {
        runFeature('table_self_copy.pil');
    });

    it("table_self_copy.pil: overlapping Tables.copy on BN128 (values wider than 64 bits)", () => {
        runFeature('table_self_copy.pil', ['--field', 'bn128']);
    });
});

describe("TableAnalysis.get", function () {
    const TableAnalysis = require('../src/table_analysis.js');

    for (const id of [false, true, null, '', undefined]) {
        it(`rejects ${JSON.stringify(id) ?? 'undefined'} as analysis id`, () => {
            assert.throws(() => TableAnalysis.get(id), /Invalid analysis id/);
        });
    }
});
