const { assert } = require('chai');
const { execFileSync } = require('child_process');
const path = require('path');

// A `col fixed virtual(n)` filled row by row (no sequence) used to take N as
// its row count on the first write, so reads past row n-1 returned 0 instead
// of failing. The row count declared by virtual(n) must survive the writes.

const PIL = path.join(__dirname, 'bug', 'virtual_fixed_rows.pil');

function compile() {
    const compiler = path.join(__dirname, '..', 'src', 'pil.js');
    try {
        return { ok: true, output: execFileSync(process.execPath, [compiler, PIL, '-o', 'none'], { encoding: 'utf8', stdio: 'pipe' }) };
    } catch (error) {
        return { ok: false, output: (error.stdout || '') + (error.stderr || '') };
    }
}

describe("A virtual fixed column filled row by row keeps its row count", function () {
    this.timeout(120000);

    let result;
    before(() => {
        result = compile();
    });

    it("reads the last declared row", () => {
        assert.include(result.output, 'V[4]= 50');
    });

    it("refuses a read past the declared rows", () => {
        assert.isFalse(result.ok, 'compilation should fail on the out-of-bounds read');
        assert.notInclude(result.output, 'V[5]=');
        assert.match(result.output, /Out-of-bounds on fixed, to access to row 5 valid indexes \[0\.\.4\]/);
    });
});
