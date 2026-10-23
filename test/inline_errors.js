const { assert } = require('chai');
const { compile, compileError, writePil } = require('./pilout_reader.js');

// An inline instance shares the air that instances it, so it can only appear inside one and it
// can't change its number of rows. With lanes it can't diverge either: the ids of a declaration
// are reserved for every lane at once, so all the lanes have to declare the same.

const LANE = 'airtemplate L(int N = 2**6) {\n    col witness a;\n    a === 0;\n}\n';

function air(body, N = '2**6') {
    return LANE + `airtemplate T(int N = ${N}) {\n${body}\n}\nairgroup G { T(); }\n`;
}

describe('Inline instance controls', () => {

    it('inherits N from the air that instances it, ignoring the default of the template', () => {
        const pil = writePil('inline_n_inherited',
            'airtemplate L(int N = 2**10) {\n    col witness a;\n    a === 0;\n}\n' +
            'airtemplate T(int N = 2**6) {\n    inline L() alias l_;\n}\nairgroup G { T(); }\n');
        assert.doesNotThrow(() => compile(pil, 'inline_n_inherited'));
    });

    it('refuses an N that is not the N of the air that instances it', () => {
        const pil = writePil('inline_n_mismatch', air('    inline L(N: 2**8) alias l_;'));
        assert.match(compileError(pil, 'inline_n_mismatch'),
                     /N of the inline instance L is 256, but the air that instances it has 64 rows/);
    });

    it('accepts an N explicitly passed when it matches', () => {
        const pil = writePil('inline_n_match', air('    inline L(N: 2**6) alias l_;'));
        assert.doesNotThrow(() => compile(pil, 'inline_n_match'));
    });

    it('refuses lanes that declare different things', () => {
        const pil = writePil('inline_lanes_diverge',
            'airtemplate L(int N = 2**6) {\n    col witness a;\n' +
            '    if (LANE == 0) { col witness x; x === 0; }\n    a === 0;\n}\n' +
            'airtemplate T(int N = 2**6) {\n    inline L() alias l_[2];\n}\nairgroup G { T(); }\n');
        assert.match(compileError(pil, 'inline_lanes_diverge'),
                     /Lane 1 of inline L declares .* but lane 0 declares .* all the lanes must declare the same/);
    });

    it('refuses lanes that declare different lengths', () => {
        // the first lane reserves the array for all of them, so a lane declaring other
        // dimensions would be bound to a slice of a different shape
        const pil = writePil('inline_lanes_lengths_diverge',
            'airtemplate L(int N = 2**6) {\n    col witness a[LANE + 2];\n    a[0] === 0;\n}\n' +
            'airtemplate T(int N = 2**6) {\n    inline L() alias l_[2];\n}\nairgroup G { T(); }\n');
        assert.match(compileError(pil, 'inline_lanes_lengths_diverge'),
                     /Lane 1 of inline L declares \(witness l_a\[3\]\) but lane 0 declares \(witness l_a\[2\]\)/);
    });

    it('refuses an inline instance out of an air', () => {
        const pil = writePil('inline_out_of_air', LANE + 'airgroup G {\n    inline L();\n}\n');
        assert.match(compileError(pil, 'inline_out_of_air'),
                     /Inline instance of L must be done inside an air/);
    });

    it('refuses to inline something that is not an airtemplate', () => {
        const pil = writePil('inline_not_a_template',
            'function f(int x) {\n    return x;\n}\n' +
            'airtemplate T(int N = 2**6) {\n    inline f(1);\n}\nairgroup G { T(); }\n');
        assert.match(compileError(pil, 'inline_not_a_template'),
                     /inline only could be used to instance an airtemplate, f isn't one/);
    });

    it('refuses an inline instance inside another one', () => {
        const pil = writePil('inline_nested',
            'airtemplate I(int N = 2**6) {\n    col witness i;\n    i === 0;\n}\n' +
            'airtemplate L(int N = 2**6) {\n    col witness a;\n    inline I() alias i_;\n    a === 0;\n}\n' +
            'airtemplate T(int N = 2**6) {\n    inline L() alias l_;\n}\nairgroup G { T(); }\n');
        assert.match(compileError(pil, 'inline_nested'),
                     /Inline instance of I inside the inline instance of L isn't supported yet/);
    });

    it('refuses a number of lanes that is not positive', () => {
        const pil = writePil('inline_lanes_zero', air('    inline L() alias l_[0];'));
        assert.match(compileError(pil, 'inline_lanes_zero'), /Invalid number of lanes 0 on inline instance/);
    });

    it('refuses multidimensional lanes', () => {
        const pil = writePil('inline_lanes_multidim', air('    inline L() alias l_[2][3];'));
        assert.match(compileError(pil, 'inline_lanes_multidim'), /ERROR Parsing/);
    });

    it('refuses lanes without a length', () => {
        const pil = writePil('inline_lanes_empty', air('    inline L() alias l_[];'));
        assert.match(compileError(pil, 'inline_lanes_empty'), /ERROR Parsing/);
    });
});
