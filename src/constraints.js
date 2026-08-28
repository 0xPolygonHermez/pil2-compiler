const Expression = require('./expression.js');
const Context = require('./context.js');
const assert = require('./assert.js');
module.exports = class Constraints {
    constructor (expressions = false) {
        this.constraints = [];
        this.expressions = expressions;
    }
    get length() {
        return this.constraints.length;
    }
    getExpressions() {
        return this.expressions ? this.expressions : Context.expressions;
    }
    clone() {
        let cloned = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        cloned.constraints = [];
        for (const constraint of this.constraints) {
            cloned.constraints.push({...constraint});
        }
        return cloned;
    }

    get(id) {
        return {...this.constraints[id]};
    }

    getExpr(id) {
        return this.getExpressions().get(this.constraints[id].exprId);
    }

    isDefined(id) {
        return (typeof this.constraints[id] != 'undefined');
    }

    getPackedExpressionId(id, container, options = {}) {
        const res = (options.expressions ?? this.getExpressions()).getPackedExpressionId(id, container, options);
        return res;
    }
    define(left, right, domain, sourceRef) {
        assert.instanceOf(left, Expression);
        assert.instanceOf(right, Expression);
        if (left.isRuntime()) {
            left.dump('LEFT  CONSTRAINT');
            throw new Error(`left constraint has runtime no resolved elements`);
        }
        if (right.isRuntime()) {
            right.dump('RIGHT CONSTRAINT');
            throw new Error(`right constraint has runtime no resolved elements`);
        }
        if (left.fixedRowAccess || right.fixedRowAccess) {
            console.log('\x1B[31mWARNING: accessing fixed row acces\x1b[0m');
        }
        const id = this.constraints.length;
        if (right.asIntDefault(false) !== 0n) {
            left.insert('sub', right);
        }
        left.simplify();
        return this.defineExpressionAsConstraint(left, domain, sourceRef);
    }
    getLastConstraintId() {
        return this.constraints.length - 1;
    }
    // domain is false (whole air) or {id, complement}, sourceRef is always the last argument.
    defineExpressionAsConstraint(e, domain, sourceRef) {
        const exprId = this.getExpressions().insert(e);
        const _domain = domain ?? false;
        return this.constraints.push({exprId, sourceRef: sourceRef ?? Context.sourceTag,
                                      domainId: _domain === false ? false : _domain.id,
                                      complementDomain: _domain === false ? false : (_domain.complement ?? false)}) - 1;
    }
    // ids of the domains used by these constraints, without repetitions and sorted
    getDomainIds() {
        let ids = [];
        for (const constraint of this.constraints) {
            const domainId = constraint.domainId ?? false;
            if (domainId !== false && !ids.includes(domainId)) ids.push(domainId);
        }
        return ids.sort((a, b) => a - b);
    }
    // [[domain, [constraintId, ...]], ...] grouped by domain, where domain is false
    // (whole air, packed first) or {id, complement}. Groups are sorted by domain id,
    // the domain before its complement.
    getGroupedByDomain() {
        let groups = new Map();
        for (const [index, constraint] of this.keyValues()) {
            const domainId = constraint.domainId ?? false;
            const complement = constraint.complementDomain ?? false;
            const key = domainId === false ? 'all' : `${domainId}:${complement ? 1 : 0}`;
            if (!groups.has(key)) {
                groups.set(key, {domain: domainId === false ? false : {id: domainId, complement}, ids: []});
            }
            groups.get(key).ids.push(index);
        }
        let res = [];
        if (groups.has('all')) {
            res.push([false, groups.get('all').ids]);
            groups.delete('all');
        }
        const sorted = [...groups.values()].sort((a, b) => a.domain.id !== b.domain.id ? a.domain.id - b.domain.id
                                                                                      : (a.domain.complement ? 1 : 0) - (b.domain.complement ? 1 : 0));
        for (const group of sorted) {
            res.push([group.domain, group.ids]);
        }
        return res;
    }
    *[Symbol.iterator]() {
        for (let index = 0; index < this.constraints.length; ++index) {
          yield this.constraints[index];
        }
    }

    *values() {
        for (let value of this.constraints) {
            yield value;
        }
    }

    *keyValues() {
        for (let index = 0; index < this.constraints.length; ++index) {
            yield [index, this.constraints[index]];
        }
    }
    dump (packed) {
        for (let index = 0; index < this.constraints.length; ++index) {
            console.log(this.getDebugInfo(index, packed));
        }
    }
    getDebugInfo(index, packed, options) {
        const constraint = this.constraints[index];
        try {
            let simpleSourceRef = typeof constraint.sourceRef == 'string' ? constraint.sourceRef.replace(/(:[\d]+):[\d]+:?$/, '$1') : constraint.sourceRef;
            
            if (!packed) {
                return simpleSourceRef;
            }
            const peid = this.getPackedExpressionId(constraint.exprId, packed, options);
            return simpleSourceRef + ' '  + packed.exprToString(peid, {...options, labels: this.getExpressions(), hideClass: true});
        } catch (e) {
            throw new Error(`ERROR generation debug info for constraint ${constraint.sourceRef}: ${e.message}`)
        }
    }
}
