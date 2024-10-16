const Function = require("../function.js");
const IntValue = require('../expression_items/int_value.js');
const Context = require('../context.js');

module.exports = class _Error extends Function {
    constructor (parent) {
        super(parent, {name: 'error', args: [], returns: [] });
    }
    mapArguments(s) {
        let texts = [];
        for (const arg of s.args) {
            if (typeof arg === 'string') {
                texts.push(arg);
                continue;
            }

            const value = arg.toString();
            texts.push(value);
        }
        return texts;
    }
    exec(s, mapInfo) {
        /* let caller = '';
        try {
            throw new Error();
        } catch (e) {
            caller = e.stack.split('\n').slice(1).join('\n');
        }
        console.log(caller);*/
        const msg = mapInfo.join(' ');
        console.log(`\x1B[1;35mERROR ${msg}\x1B[0m`);
        throw new Error(`ERROR: ${msg} at ${Context.sourceRef}`);
    }
}
