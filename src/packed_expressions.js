const util = require('util');
const assert = require('./assert.js');

const OPERATOR_SYMBOLS = {mul: '*', add: '+', sub:'-', neg:'-'};
const VALID_OBJ_TYPES = ['constant','challenge','airGroupValue','proofValue','publicValue','periodicCol','fixedCol','witnessCol','expression'];
module.exports = class PackedExpressions {

    constructor () {
        this.expressions = [];
        this.values = [];
    }
    insert(expr) {
        return this.expressions.push(expr) - 1;
    }
    insertTop() {
        return this.insert({add: {lhs: this.pop(1)[0], rhs:{constant: {value : 0n}}}});
    }
    pop(count, operation = false) {
        if (this.values.length < count) {
            throw new Error(`Not enought elements (${this.values.length} vs ${count}) for operation ${operation}`);
        }
        return this.values.splice(-count, count);
    }
    mul() {
        const [lhs, rhs] = this.pop(2, 'mul');
        return this.insert({mul: {lhs, rhs}});
    }

    add() {
        const [lhs, rhs] = this.pop(2, 'add');
        return this.insert({add: {lhs, rhs}});
    }
    sub() {
        const [lhs, rhs] = this.pop(2, 'sub');
        return this.insert({sub: {lhs, rhs}});
    }
    neg() {
        const [value] = this.pop(1, 'neg');
        return this.insert({sub: {value}});
    }
    push(obj) {
        if (assert.isEnabled) assert.ok(VALID_OBJ_TYPES.includes(Object.keys(obj)[0]));
        this.values.push(obj);
    }
    pushConstant (value) {
        this.values.push({constant: {value}});
    }
    pushChallenge (idx, stage = 1) {
        assert.defined(idx);
        this.values.push({challenge: {stage, idx}});
    }
    pushAirGroupValue (idx, stage, airGroupId) {
        assert.defined(idx);    
        this.values.push({airGroupValue: {idx, stage, airGroupId}});
    }
    pushAirValue (idx, stage) {
        assert.defined(idx);    
        this.values.push({airValue: {idx, stage}});
    }
    pushProofValue (idx) {
        assert.defined(idx);
        this.values.push({proofValue: {idx}});
    }
    pushPublicValue (idx) {
        assert.defined(idx);
        this.values.push({publicValue: {idx}});
    }
    pushPeriodicCol (idx, rowOffset = 0) {
        assert.defined(idx);
        this.values.push({periodicCol: {idx, rowOffset}});
    }
    pushFixedCol (idx, rowOffset = 0) {
        assert.defined(idx);
        this.values.push({fixedCol: {idx, rowOffset}});
    }
    pushWitnessCol (colIdx, rowOffset = 0, stage = 1) {
        assert.defined(colIdx);
        this.values.push({witnessCol: {colIdx, rowOffset, stage}});
    }
    pushExpression (idx) {
        assert.defined(idx);
        this.values.push({expression: {idx}});
    }
    dump() {
        console.log(util.inspect(this.expressions, false, null, true /* enable colors */));
    }
    exprToString(id, options) {
        assert.typeOf(id, 'number');
        const expr = this.expressions[id];
        if (!expr) {
            console.log(expr);
            debugger;
        }
        const [op] = Object.keys(expr);
        let opes = [];
        for (const ope of Object.values(expr[op])) {
            opes.push(this.operandToString(ope, options));
        }

        if (opes.length == 1) {
            return `${OPERATOR_SYMBOLS[op]}${opes[0]}`;
        }
        return opes.join(OPERATOR_SYMBOLS[op]);
    }
    rowOffsetToString(rowOffset, e) {
        if (rowOffset < 0) {
            return (rowOffset < -1 ? `${-rowOffset}'${e}` : `'${e}`);
        }
        if (rowOffset > 0) {
            return (rowOffset > 1 ? `${e}'${-rowOffset}` : `${e}'`);
        }
        return e;
    }
    operandToString(ope, options) {
        const [type] = Object.keys(ope);
        const props = ope[type];
        switch (type) {
            case 'constant':
                return ope.constant.value;

            case 'fixedCol':
                return this.rowOffsetToString(props.rowOffset, this.getLabel('fixed', props.idx, options));

            case 'witnessCol':
                return this.rowOffsetToString(props.rowOffset, this.getLabel('witness', props.colIdx, options));

            case 'publicValue':
                return this.getLabel('public', props.idx, options);

            case 'expression':
                return '('+this.exprToString(props.idx, options)+')';

            case 'challenge':
                return this.getLabel('challenge', props.idx, options);

            case 'airGroupValue':
                return this.getLabel('airgroupvalue', props.idx, options);

            case 'proofValue':
                return this.getLabel('proofvalue', props.idx, options);

            default:
                console.log(ope);
                throw new Error(`Invalid type ${type}`)
        }

    }
    getLabel(type, id, options = {}) {
        const labelSources = [(options.labelsByType ?? {})[type], options.labels];
        let args = [id, options];
        for (const labels of labelSources) {
            if (labels) {
                if (typeof labels === 'function') {
                    return labels.apply(null, args);
                }
                if (typeof labels.getLabel === 'function') {
                    return labels.getLabel.apply(labels, args);
                }
            }
            args.unshift(type);
        }
        return label = `${type}@${id}`;
    }

    *[Symbol.iterator]() {
        for (let index = 0; index < this.expressions.length; ++index) {
          yield this.expressions[index];
        }
    }

}
