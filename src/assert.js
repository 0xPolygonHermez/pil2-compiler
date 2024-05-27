function equal(actual, expected, message) {
    if (actual == expected) return;
    _message(message, `${actual} not equal ${expected}`, actual);
}

function notEqual(actual, expected, message) {
    if (actual != expected) return;
    _message(message, `${actual} is equal ${expected}`, actual);
}

function strictEqual(actual, expected, message) {
    if (actual === expected) return;
    _message(message, `${actual} not strict equal ${expected}`, actual);
}

function notStrictEqual(actual, expected, message) {
    if (actual !== expected) return;
    _message(message, `${actual} is strict equal ${expected}`, actual);
}

function returnInstanceOf(actual, cls, message) {
    if (actual instanceof cls) return actual;
    if (actual && actual.constructor) {
        return _message(`value(${actual.constructor.name}) isn't an instance of ${cls}`, actual);
    }
    _message(message, `value isn't an instance of ${cls}`, actual);
}

function returnNotInstanceOf(actual, cls, message) {
    if ((actual instanceof cls) === false) return actual;
    if (actual && actual.constructor) {
        return _message(`value(${actual.constructor.name}) is instance of ${cls}`, actual);
    }
    _message(message, `value is an instance of ${cls}`, actual);
}

function typeOf(actual, typename, message) {
    if (typeof actual === typename) return actual;
    _message(message, `value isn't typeof ${typename}`, actual);
}

function notTypeOf(actual, typename, message) {
    if (typeof actual !== typename) return actual;
    _message(message, `value is typeof ${typename}`, actual);
}

function _message(message, defaultmsg = false, value = false) {
    if (typeof value === 'object' && (!value || typeof value.toString !== 'function')) { 
        console.log(value);
    }
    if (typeof message === 'object') { 
        console.log(message);
        throw new Error('ASSERT:' + defaultmsg);
    }
    throw new Error('ASSERT:' + (message ?? defaultmsg));
}

function defined(value, message) {
    if (typeof value !== 'undefined') return true;
    _message(message, 'not defined value', value);
}   

function _undefined(value, message) {
    if (typeof value === 'undefined') return true;
    _message(message, `defined value ${value}`, value);
}   

function ok(value, message) {
    if (value) return true;
    _message(message, `defined value ${value}`);
}   

/*
const _exports = {
    enable,
    disable,
    isEnabled: true,
    equal,
    notEqual,
    strictEqual,
    notStrictEqual,
    defined,
    undefined: _undefined,
    returnInstanceOf,
    instanceOf: returnInstanceOf,
    returnNotInstanceOf,
    notInstanceOf: returnNotInstanceOf,
    typeOf,
    notTypeOf,
    ok,
}
*/

const _exports = {
    enable,
    disable,
    isEnabled : false,
    equal : () => {},
    notEqual : () => {},
    strictEqual : () => {},
    notStrictEqual : () => {},
    defined : () => {},
    undefined : () => {},
    returnInstanceOf : (value) => value,
    instanceOf : () => {},
    returnNotInstanceOf : (value) => value,
    notInstanceOf : () => {},
    typeOf : () => {},
    notTypeOf : () => {},
    ok : () => {},
}

function enable(value = true) {
    if (!value) return disable();        

    _exports.isEnabled = true;
    _exports.equal = equal;
    _exports.notEqual = notEqual;
    _exports.strictEqual = strictEqual;
    _exports.notStrictEqual = notStrictEqual;
    _exports.defined = defined;
    _exports.undefined = _undefined;
    _exports.returnInstanceOf = returnInstanceOf;    
    _exports.instanceOf = returnInstanceOf;    
    _exports.returnNotInstanceOf = returnNotInstanceOf;    
    _exports.notInstanceOf = returnNotInstanceOf;    
    _exports.typeOf = typeOf;    
    _exports.notTypeOf = notTypeOf;    
    _exports.ok = ok;
    _showState();
}

function disable() {
    _exports.isEnabled = false;
    _exports.equal = () => {};
    _exports.notEqual = () => {};
    _exports.strictEqual = () => {};
    _exports.notStrictEqual = () => {};
    _exports.defined = () => {};
    _exports.undefined = () => {};
    _exports.returnInstanceOf = (value) => value;
    _exports.instanceOf = () => {};
    _exports.returnNotInstanceOf = (value) => value;
    _exports.notInstanceOf = () => {};
    _exports.typeOf = () => {};
    _exports.notTypeOf = () => {};
    _exports.ok = () => {};
    _showState();
}

function _showState() {
    console.log('ASSERT STATE: '+(_exports.isEnabled ? '\x1B[1;32mON':'\x1B[1;31mOFF')+'\x1B[0m');
}

module.exports = _exports;
