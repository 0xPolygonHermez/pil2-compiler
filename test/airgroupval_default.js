const { assert } = require('chai');
const { fixture, compile, load, findAir } = require('./pilout_reader.js');

// The default constraint of an airgroupval reaches the airs that don't declare
// it by two paths: the current air goes through the regular constraints, an air
// already packed on the pilout gets the constraint added straight to the proto.
// Both must produce the constraint variant of the pilout version generated.

// the current air packs it as a regular constraint (G.agv-7), an already packed
// air gets it with the fixed debug line
const DEFAULT_LINE = /airgroup default value \(7\)|G\.agv-7$/;

// [variant, debugLine] of each constraint of an air
function constraintKinds(pilout, airName) {
    return findAir(pilout, airName).air.constraints.map(constraint => {
        const kind = Object.keys(constraint)[0] ?? false;
        return [kind, kind ? constraint[kind].debugLine : ''];
    });
}

function expectDefaultConstraint(pilout, airName, variant) {
    const kinds = constraintKinds(pilout, airName);
    assert.equal(kinds.length, 2, `${airName} must have its own constraint plus the default one`);
    assert.equal(kinds[0][0], variant);
    assert.equal(kinds[1][0], variant, `${airName} default constraint must be ${variant}`);
    assert.match(kinds[1][1], DEFAULT_LINE);
}

describe('Airgroupval default constraint on the airs that don\'t declare it', () => {
    describe('pilout version 2', () => {
        let pilout;

        before(() => {
            pilout = load(compile(fixture('airgroupval_default_previous_air.pil'), 'airgroupval_default_v2'));
        });

        it('is packed as allRows on the air closed before the airgroupval was declared', () => {
            expectDefaultConstraint(pilout, 'Before', 'allRows');
        });

        it('is packed as allRows on the air that follows the declaration', () => {
            expectDefaultConstraint(pilout, 'After', 'allRows');
        });
    });

    describe('pilout version 1', () => {
        let pilout;

        before(() => {
            pilout = load(compile(fixture('airgroupval_default_previous_air.pil'), 'airgroupval_default_v1',
                                  ['-O', 'pilout-version=1']), 1);
        });

        it('is packed as everyRow on the air closed before the airgroupval was declared', () => {
            expectDefaultConstraint(pilout, 'Before', 'everyRow');
        });

        it('is packed as everyRow on the air that follows the declaration', () => {
            expectDefaultConstraint(pilout, 'After', 'everyRow');
        });
    });
});
