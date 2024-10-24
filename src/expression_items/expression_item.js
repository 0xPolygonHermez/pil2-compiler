/*                      cexp  next  ind  Parent          Item            DefClas         Definition
                        ----  ----  ---  --------------  --------------  --------------  ---------------------------------------------
    Challenge             -     -    *   ProofItem  id              ProofStageDef   id + stage [used]
    SubExpression         -     *    *   ProofItem       id              -               id [const,use]
    FeValue               -     -    -   ValueItem       value           -               value (fe) [const]
    IntValue              *     -    -   ValueItem       value           -               value (bigint) [const]
    FixedCol              -     -    *   ProofItem       id              -               id [used]
    FunctionCall          *     *    ?   RuntimeItem     "id",argValues  Function        name,args,return,statements
    ProofValue            -     -    *   ProofItem       id              -               id [used]
    Public                -     -    *   ProofItem       id              -               id [used]
    Publictable           -     -    *   ProofItem       id              PublictableDef  id + numCols,maxRows,aggType,rowExpressionId [used]
    *PublictableCol       -     -    *   ProofItem       id,colId        -               [const, used]
    ReferenceItem         *     *    *   RuntimeItem     name            ?               name + type, instance, etc.
    StackItem             -     -    -   ExpressionItem  offset          -               -
    StringValue           *     -    -   RuntimeItem     value           -               value (string) [const, used]
    AirGroupValue         -     -    *   ProofItem       id              AirGroupValue   id + airGroupId [used]
    WitnessCol            -     *    *   ProofItem       id              ProofStageDef   id + stage [used]


                         Type          List                     Item
                         ----------    --------------           --------------
    Challenge            challenge     challenges (Ids)         id               Ids: new cls(id)
    Expression           expr          exprs (Variables)        value            Variables: new cls(value)
    SubExpression        subexpr       subexprs (Ids)           id               Ids: new cls(id)
    FeValue              fe            fes (Variables)          value            Variables: new cls(value)
    IntValue             int           ints (Variables)         value            Variables: new cls(value)
    *IntValue            constant      constants (Indexable)    value            Variables: new cls(value)
    FixedCol             fixed         fixeds (FixedCols)       id               Ids: new cls(id)
    FunctionCall         function      functions (Indexable)    "id",argValues
    ProofValue           proofvalue    proofValues (Ids)        id               Ids: new cls(id)
    Public               public        publics (Ids)            id               Ids: new cls(id)
    Publictable          publictable                            id
    *PublictableCol                                            id,colId
    ReferenceItem        -             references (References)  name
    StackItem            -                                     offset
    StringValue          string        strings (Variables)      value            Variables: new cls(value)
    AirGroupValue        airgroupvalue airGroupValues (Ids)     id               Ids: new cls(id)
    WitnessCol           witness       witness (WitnessCols)    id               WitnessCols: new WitnessCol(id, stage)



    cexp: compiler expression (build)
    next: allowed next
    ind:  allowed indexes

    ExpressionItem > ProofItem
                   > RuntimeItem
                   > ValueItem

    Array information on reference

    ArrayOf (multiarray, from: ExpressionItem)
    ArrayOf (multiarray, [ExpressionItem]) = List

*/
const Exceptions = require('../exceptions.js');
const Debug = require('../debug.js');
class ExpressionItem {
    static _classToManager = {};

    constructor(options = {}) {
        this.options = options;
        this.indexes = false;
        this.label = options.label ?? '';
        this._ns_ = 'ExpressionItem';
    }
    static registerClass(name, cls) {
        ExpressionItem[name] = cls;
    }
    setLabel (label) {
        if (Debug.active) console.log(['SETLABEL', label]);
        this.label = label;
    }
    get dim () {
        return Array.isArray(this.indexes) ? this.indexes.length : 0;
    }
    popArrayIndex () {
        if (this.indexes === false) {
            throw new Error(`try to add index to non-indexable element`);
        }
        if (typeof this.indexes === 'undefined') {
            this.indexes = [];
        }
        this.indexes.push(ExpressionItem.IntValue(index));
    }
    pushArrayIndex () {
        if (this.indexes === false) {
            throw new Error(`try to add an index to non-indexable element`);
        }
        if (this.dim < 1) {
            throw new Error(`try to remove an index from element without indexes`);
        }
        return this.indexes.pop();
    }
    toString(options) {
        return this.getTag() + '(' + this.label + ')';
    }
    dump(options) {
        return this.toString(options);
    }
    dumpItem(options) {
        return this.dump(options);
    }
    getTag() {
        return this.constructor.name;
    }
    get type() {
        console.log(this);
        throw new Error(`FATAL: use type obsolete-property`)
    }
    getRowOffset() {
        return this.rowOffset ? this.rowOffset.value : 0;
    }
    getRowOffsetStrings(options) {
        if (!this.rowOffset) return ['',''];
        return this.rowOffset.getStrings();
    }
    static setManager(cls, manager) {
        if (Debug.active) console.log(['SET_MANAGER', cls.name]);
        ExpressionItem._classToManager[cls.name] = manager;
    }
    getManager() {
        if (Debug.active) console.log(['GET_MANAGER', this.constructor.name]);
        return ExpressionItem._classToManager[this.constructor.name];
    }
    _asDefault(method, defaultValue = false) {
        try {
            return method.apply(this, [defaultValue]);
        } catch (e) {
            if (e instanceof Exceptions.CannotBeCastToType) {
                return defaultValue;
            }
            throw e;
        }
    }
    get rowOffset() {
        return this._rowOffset;
    }
    set rowOffset(value) {
        if (Debug.active) {
            if (!value.isZero()) console.log(['ROWOFFSET.SET', value]);
        }
        this._rowOffset = value;
    }
    clone() {
        let cloned = this.cloneInstance();
        cloned.cloneUpdate(this);
        return cloned;
    }
    cloneUpdate(source) {
        if (source.indexes) {
            this.indexes = source.indexes.map(index => (typeof index === 'object' && typeof index.clone === 'function') ? index.clone() : index);
        }
        if (source.label) {
            this.label = source.label;
        }
    }
    evalInside(options = {}) {
        throw new Error(`evalInside not defined for class ${this.constructor.name}`);
    }
    evalPrior(options) {
        if (!this.rowOffset || !this.rowOffset.isPriorRows()) {
            return false;
        }
        const value = this.rowOffset.getValue(options);
        return value;
    }
    evalNext(options) {
        if (!this.rowOffset || !this.rowOffset.isNextRows()) {
            return false;
        }
        const value = this.rowOffset.getValue(options);
        return value;
    }
    eval(options) {
        let results = {};
        const _options = options ? {...options, results} : {results};
        results.prior = this.evalPrior(options);
        results.inside = this.evalInside({...options, asItem: true});
        results.next = this.evalNext(options);
        return results.final ? results.final : results.inside;
    }
    evalAsItem(options) {
        return this.clone();
    }
    instance(options) {
        return this.clone();
    }
    isEmpty() {
        // default implementation
        return false;
    }
    isUnrolled() {
        // default implementation
        return false;
    }
    isRuntimeEvaluable() {
        // default implementation
        return true;
    }
    isInstanceOf(cls) {
        return (this instanceof cls);
    }
    isAlone() {
        return true;
    }
    getAloneOperand() {
        return this;
    }
}

module.exports = ExpressionItem;