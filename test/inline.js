const { assert } = require('chai');
const { fixture, compile, compileOutput, load, findAir, airSymbols, rawConstraints,
        SYMBOL_TYPE } = require('./pilout_reader.js');

// `inline <airtemplate>(...)` expands an airtemplate inside the air that instances it, no air
// is created: its columns and constraints belong to the host air and share its number of rows.
// The alias is the prefix of the names it declares (`_` meaning no prefix) and it can carry a
// number of identical lanes, which turn every declaration into an array with the lane as its
// outermost dimension.

describe('Inline instances of an airtemplate', () => {
    let pilout;

    before(() => {
        pilout = load(compile(fixture('inline.pil'), 'inline'));
    });

    function witness(airName) {
        return airSymbols(pilout, findAir(pilout, airName), SYMBOL_TYPE.WITNESS_COL);
    }

    it("doesn't create an air for the inlined template", () => {
        const airs = (pilout.airGroups ?? []).flatMap(airGroup => (airGroup.airs ?? []).map(air => air.name));
        assert.deepEqual(airs, ['InlineAir', 'InlineLanes']);
    });

    it('declares the columns of the instance on the air that inlines it', () => {
        // Lane declares a, b and v[2]. Without alias the names are used as they are, with an
        // alias they are prefixed with it, and the ids of each declaration are consecutive.
        assert.deepEqual(witness('InlineAir').slice(0, 7), [
            ['t', 0, []],
            ['a', 1, []], ['b', 2, []], ['v', 3, [2]],
            ['one_a', 5, []], ['one_b', 6, []], ['one_v', 7, [2]],
        ]);
    });

    it('reserves the columns of all the lanes at once, the lane being the outermost dimension', () => {
        // 4 lanes of a, b and v[2] are a[4], b[4] and v[4][2], each one a single consecutive
        // range of ids: the ids of an array have to be consecutive.
        assert.deepEqual(witness('InlineAir').slice(7), [
            ['lanes_a', 9, [4]], ['lanes_b', 13, [4]], ['lanes_v', 17, [4, 2]],
        ]);
    });

    it('keeps the names unprefixed when the alias is _', () => {
        assert.deepEqual(witness('InlineLanes'), [
            ['a', 0, [3]], ['b', 3, [3]], ['v', 6, [3, 2]],
        ]);
    });

    it('prefixes the air values of the instance like its columns', () => {
        const airValues = airName => airSymbols(pilout, findAir(pilout, airName), SYMBOL_TYPE.AIR_VALUE);
        // air values carry the name of their air, as they always do
        assert.deepEqual(airValues('InlineAir'), [
            ['InlineAir.pad', 0, []], ['InlineAir.one_pad', 1, []], ['InlineAir.lanes_pad', 2, [4]],
        ]);
        assert.deepEqual(airValues('InlineLanes'), [['InlineLanes.pad', 0, [3]]]);
    });

    it('shares the rows of the host air with the instance', () => {
        for (const name of ['InlineAir', 'InlineLanes']) {
            assert.equal(findAir(pilout, name).air.numRows, 2 ** 8);
        }
    });

    it('generates the constraints of the body once per lane, over the columns of that lane', () => {
        // one constraint per instance (1 + 1 + 4) plus the one of the air itself
        assert.equal((findAir(pilout, 'InlineAir').air.constraints ?? []).length, 7);
        assert.equal((findAir(pilout, 'InlineLanes').air.constraints ?? []).length, 4);

        // W is 4 and LANE * LANES is 0, 3 and 6 on the constraint of the template
        const output = compileOutput(fixture('inline.pil'), 'inline_constraints',
                                     ['-O', 'output-constraints', '-O', 'raw-constraints-format']);
        const constraints = rawConstraints(output).filter(([air]) => air === 'InlineLanes').map(([, c]) => c);
        assert.deepEqual(constraints, [
            'a[0] * b[0] - (4 + v[0][0] + v[0][1])',
            'a[1] * b[1] - (4 + v[1][0] + v[1][1] + 3)',
            'a[2] * b[2] - (4 + v[2][0] + v[2][1] + 6)',
            'a[0] - (a[1] + a[2])',
        ]);
    });

    it('expands an expression of the instance over the columns of its lane', () => {
        // sum is a + b, so lanes_sum[2] on the air that inlines it is lanes_a[2] + lanes_b[2]
        const output = compileOutput(fixture('inline.pil'), 'inline_exprs',
                                     ['-O', 'output-constraints', '-O', 'raw-constraints-format']);
        const constraints = rawConstraints(output).filter(([air]) => air === 'InlineAir').map(([, c]) => c);
        assert.equal(constraints.at(-1),
                     't - (a + one_b + lanes_a[3] + lanes_v[2][1] + lanes_a[2] + lanes_b[2])');
    });
});
