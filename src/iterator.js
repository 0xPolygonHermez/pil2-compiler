const Expression = require("./expression.js");
const assert = require('./assert.js');

module.exports = class Iterator {

    constructor (expr) {
        this.setExpression(expr);
    }
    setExpression(expr) {
        console.log(expr);
        if ((expr instanceof Expression) === false || expr.isReference() === false) {
            throw new Error(`Invalid iterator`);
        }
        this.index = 0;
        this.expr = expr.eval();
        assert.ok(this.expr.array, this.expr);
        // this.reference = this.expr.getReference();
        // this.count = this.reference.array.getLength(0);
    }
    goFirst() {
        this.index = 0;
    }

    goLast() {
        this.index = this.count - 1;
    }

    isFirst() {
        return (this.index < 0);
    }
    isLast() {
        return (this.index === this.count);
    }

    goNext() {
        if (this.isLast()) return false;
        ++this.index;
        return true;
    }
    goPrior() {
        if (this.isFirst()) return false;
        --this.index;
        return true;
    }

    getValue() {
        return this.expr.array.applyIndexes(this.expr, [this.index]);
    }

    *[Symbol.iterator]() {
        this.goFirst();
        while (!this.isLast()) {
            yield this.getValue();
            this.goNext();
        }
    }
}
