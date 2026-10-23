const { assert } = require('chai');
const { execFileSync } = require('child_process');
const path = require('path');

// evaluate(row, expr) passed the raw first argument as the row, so any row that
// was not a literal became NaN, and the row offsets of the expression ('F, F')
// were dropped because the reference was resolved to a value before the offset
// was applied.

const PIL = path.join(__dirname, 'bug', 'evaluate_row.pil');

function compile() {
    const compiler = path.join(__dirname, '..', 'src', 'pil.js');
    try {
        return execFileSync(process.execPath, [compiler, PIL, '-o', 'none'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
        throw new Error(`compiling ${PIL} failed:\n${(error.stdout || '') + (error.stderr || '')}`);
    }
}

describe("evaluate(row, expr)", function () {
    this.timeout(120000);

    let output;
    before(() => {
        output = compile();
    });

    const expected = {
        'literal': 30,
        'int expr': 30,
        'int var': 30,
        'prev': 20,
        'next': 40,
        'next2': 50,
        'prev2': 10,
        'sum': 90,
        'wrap prev': 80,
        'wrap next': 10,
    };
    for (const [label, value] of Object.entries(expected)) {
        it(`${label} -> ${value}`, () => {
            assert.include(output, `${label}:  ${value}`);
        });
    }
});
