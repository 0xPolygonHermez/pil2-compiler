const ExpressionItem = require("./expression_item.js");

module.exports = class FixedRow extends ExpressionItem {
    constructor (col, row, options = {}) {
        super(options);
        this.col = col;
        this.row = row;
    }
    getValue() {
        return this.col.getValue(this.row);
    }
    setValue(value) {
        return this.col.setValue(this.row, value);
    }
    cloneInstance() {
        return new FixedRow(this.col, this.row, this.options);
    }
    evalInside(options = {}) {
        return this.getValue();
    }
}
