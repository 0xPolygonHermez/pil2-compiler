const Expression = require("./expression.js");
const Context = require('./context.js');
const NonRuntimeEvaluableItem = require('./expression_items/non_runtime_evaluable_item.js');
const Debug = require('./debug.js');
const util = require('util');
const assert = require('./assert.js');

module.exports = class Assign {
    constructor () {
    }
    assign (name, indexes, value) {
        if (Debug.active) {
            console.log(util.inspect(value, false, 200, true));
            console.log(indexes);
        }
        value = this.getValue(value);
        if (Debug.active) console.log(util.inspect(value, false, 200, true));
        assert.notStrictEqual(value, null);
        return this.#assign(name, indexes, value);
    }
    getValue(value) {
        if (typeof value.eval !== 'function') {
            return value;
        }
        const _value = value.eval();
        if (typeof _value !== 'undefined' && _value !== null && (_value instanceof NonRuntimeEvaluableItem) === false) {
            return _value;
        }
        return value;
    }
    #assign (name, indexes, value) {
        const reference = Context.references.getReference(name);
        return reference.set(value, indexes);
    }
    assignType(type, name, indexes, value) {
        if (Debug.active) console.log(type);
        switch (type) {
            case 'int': return this.assignTypeInt(name, indexes, value, type);
            case 'expr': return this.assignTypeExpr(name, indexes, value, type);
        }
    }
    assignArray(name, indexes, value, array) {
        console.log(`ASSIGN_ARRAY(${name})[#${indexes.length ?? 0}] = ${value.constructor ? (value.constructor.name ?? typeof value):typeof value}`);
        const ref = value.getAloneOperand();
        let valueIndexes = value.__indexes ?? [];
        const def = Context.references.getDefinition(ref.name);

        if (array.dim != def.array.dim) {
            throw new Error(`different array dimension on asignation ${array.dim} vs ${def.array.dim}`);
        }
        this.assignArrayLevel(0, name, indexes, value, def.array, array);
        // array.lengths[0] != def.array.lengths[0]) {
    }
    assignArrayLevel(level, name, indexes, value, leftArray, rightArray) {
        console.log(`ASSIGN_ARRAY_LEVEL(${level},${name})[#${indexes.length ?? 0}] = ${value.constructor ? (value.constructor.name ?? typeof value):typeof value}`);
        // console.log(['assignArrayLevel', level, name, indexes]);
        const len = leftArray.lengths[level];
        for (let index = 0; index < len; ++index) {
            let _indexes = [...indexes];
            _indexes.push(index);
            value.pushAloneIndex(index);
            if (level + 1 === leftArray.dim) {
                this.#assign(name, _indexes, value.evaluateAloneReference());
            } else {
                this.assignArrayLevel(level+1, name, _indexes, value, leftArray, rightArray);
            }
            value.popAloneIndex();
        }
    }
    assignReference (name, value) {
        console.log(`ASSIGN_REFERENCE(${level},${name}) = ${value.constructor ? (value.constructor.name ?? typeof value):typeof value}`);
        Context.references.setReference(name, value);
    }
    assignTypeInt(name, indexes, value, type) {
        // TODO: WARNING: e2value an extra evaluation
        const v = Expression.getValue(value);
        if (typeof v === 'number' || typeof v === 'bigint') {
            return Context.references.set(name, indexes, v);
        }
    }
    assignTypeExpr(name, indexes, value, type) {
        console.log(`ASSIGN_TYPE_EXPR(${name},${type})[#${indexes.length ?? 0}] = ${value.constructor ? (value.constructor.name ?? typeof value):typeof value}`);
        if (!(value instanceof Expression)) {
            Context.references.set(name, indexes, value);
            return;
        }
        value = value.instance(true);
        if (Context.sourceRef === 'std_sum.pil:195') {
            if (Debug.active) console.log('XXX');
        }
        if (Debug.active) console.log(`ASSIGN ${Context.sourceRef} ${value}`);
        Context.references.set(name, indexes, value);
    }
}
