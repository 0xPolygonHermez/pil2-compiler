const { assert } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Compiles every .pil under test/features and test/bug, so a pil that stops
// compiling, or whose assert/assert_eq fail, breaks npm test instead of rotting.
// A failing assert aborts the compilation and, under `#pragma test`, makes it
// exit with an error, so the exit code is enough to know if a pil passes.
//
// Each pil runs in its own process (the Context is a per-process singleton),
// with tmp/ as working directory because some pils dump fixed columns to files.
//
// New pils are picked up automatically. Only the exceptions are listed below.

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'src', 'pil.js');
const CWD = path.join(ROOT, 'tmp', 'pil_fixtures');
const DIRS = ['features', 'bug'];

// pils with their own spec, which checks more than "compiles and asserts pass"
const OWN_SPEC = {
    'bug/const_expr_row_offset.pil': 'const_expr_row_offset.js',
    'bug/evaluate_row.pil': 'evaluate_row.js',
    'bug/virtual_fixed_rows.pil': 'virtual_fixed_rows.js',
    'features/table_analyze.pil': 'table_analyze.js',
    'features/table_signatures.pil': 'table_signatures.js',
    'features/fixed_function_arg.pil': 'feature_fixtures.js',
    'features/table_get_value.pil': 'feature_fixtures.js',
    'features/table_self_copy.pil': 'feature_fixtures.js',
};

// pils that reproduce an error: they must fail, and with this message
const EXPECTED_ERRORS = {
    'bug/fixed_out_of_bounds.pil': /sequence is too large/,
};

// pils that fail today because of open issues of the compiler (or of the
// language), skipped until they are resolved
const KNOWN_FAILURES = {
    'bug/airgroupval_not_all_airs.pil': 'an airgroupval declared inside a container airgroup can\'t be referenced from the proof scope',
    'bug/subproof_value_in_container.pil': 'an airgroupval declared inside a container airgroup is only declared on the first instance',
    'features/builtin/defined.pil': 'functions declared inside an airtemplate don\'t see the declarations of the air',
    'features/packages.pil': '`use` of a package isn\'t supported',
};

function listPils() {
    const pils = [];
    const walk = (dir, rel) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const relPath = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath);
            else if (entry.name.endsWith('.pil')) pils.push(relPath);
        }
    };
    for (const dir of DIRS) walk(path.join(__dirname, dir), dir);
    return pils;
}

function compile(pil) {
    fs.mkdirSync(CWD, { recursive: true });
    const res = spawnSync(process.execPath, [CLI, path.join(__dirname, pil), '-o', 'none'],
                          // some pils print several MB (println of whole tables)
                          { cwd: CWD, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const output = (res.stdout || '') + (res.stderr || '');
    return { ok: res.status === 0 && !output.includes('tests FAIL'), output };
}

describe("pil fixtures (test/features, test/bug)", function () {
    this.timeout(120000);

    const pils = listPils();

    it("the lists of exceptions only name existing pils", () => {
        const listed = [...Object.keys(OWN_SPEC), ...Object.keys(EXPECTED_ERRORS), ...Object.keys(KNOWN_FAILURES)];
        assert.deepEqual(listed.filter(pil => !pils.includes(pil)), []);
    });

    for (const pil of pils) {
        if (OWN_SPEC[pil]) continue;

        if (KNOWN_FAILURES[pil]) {
            it.skip(`${pil} (known failure: ${KNOWN_FAILURES[pil]})`);
            continue;
        }

        const expectedError = EXPECTED_ERRORS[pil];
        if (expectedError) {
            it(`${pil} fails with ${expectedError}`, () => {
                const { ok, output } = compile(pil);
                assert.isFalse(ok, `${pil} was expected to fail:\n${output}`);
                assert.match(output, expectedError);
            });
            continue;
        }

        it(pil, () => {
            const { ok, output } = compile(pil);
            assert.isTrue(ok, `${pil} failed:\n${output}`);
        });
    }
});
