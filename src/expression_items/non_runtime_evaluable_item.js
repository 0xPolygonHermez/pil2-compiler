const ExpressionItem = require("./expression_item.js");


class NonRuntimeEvaluableItem extends ExpressionItem {

    static _singletonInstance = new NonRuntimeEvaluableItem();
    constructor () {
        super();
        this.nonRuntimeEvaluableItem = true;
    }
    static get () {
        return NonRuntimeEvaluableItem._singletonInstance;
    }
    cloneInstance() {
        return NonRuntimeEvaluableItem._singletonInstance;
    }
    eval(options) {
        return NonRuntimeEvaluableItem._singletonInstance;;
    }
    isRuntimeEvaluable() {
        return false;
    }
}
Object.freeze(NonRuntimeEvaluableItem._singletonInstance);

module.exports = NonRuntimeEvaluableItem;