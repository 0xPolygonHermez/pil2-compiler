const Context = require('./context.js');

/**
 * An inline instance expands an airtemplate inside the air that instances it. Its columns,
 * expressions and constraints belong to the host air and share its number of rows, no new
 * air is created.
 *
 * The alias of the instance is a prefix applied to the names it declares, `_` meaning no
 * prefix, and it could declare a number of identical instances (lanes): `alias lanes_[4]`.
 *
 * With lanes, the body is executed once per lane, but the ids of a declaration must be
 * reserved at once for all of them, because the ids of an array must be consecutive. The
 * first lane reserves the whole array, with the lane as the outermost dimension, and each
 * lane binds the name used inside the body to its own slice of it.
 */
module.exports = class InlineInstance {

    /**
     * types expanded by an inline instance: they are prefixed and, with lanes, reserved as
     * an array for all the lanes. They are the declarations that live on the air, the rest
     * (variables, functions, ...) remain local to the instance.
     */
    static EXPANDED_TYPES = ['witness', 'fixed', 'customcol', 'im', 'airvalue'];

    /**
     * variables expanded by an inline instance, but only the ones declared at the top level of
     * its body: they are its interface. On deeper scopes (blocks, loops, ...) they are the
     * temporaries of the instance and remain local to it.
     */
    static EXPANDED_VARIABLE_TYPES = ['expr'];

    constructor (template, prefix, lanes, options = {}) {
        this.template = template;
        this.prefix = prefix;
        this.lanes = lanes;
        this.count = lanes === false ? 1 : lanes;
        this.sourceRef = options.sourceRef ?? Context.sourceRef;
        this.hostDeep = options.hostDeep ?? false;
        this.lane = 0;
        this.bodyDeep = false;
        this.declarations = false;
        this.laneDeclarations = [];
    }
    /**
     * declarations expanded by the instance. They are always declared on the scope of the air,
     * even without prefix and without lanes, to be visible once the instance ends.
     */
    isExpanded(type) {
        return InlineInstance.EXPANDED_TYPES.includes(type);
    }
    isExpandedVariable(type, deep) {
        return deep === this.bodyDeep && InlineInstance.EXPANDED_VARIABLE_TYPES.includes(type);
    }
    get laneIndex() {
        return this.lanes === false ? false : this.lane;
    }
    startLane(lane) {
        this.lane = lane;
        this.laneDeclarations = [];
    }
    endLane() {
        if (this.declarations === false) {
            this.declarations = this.laneDeclarations;
            return;
        }
        // the ids of a declaration are reserved for all the lanes on the first one, so the
        // lanes must declare exactly the same things, in the same order.
        const first = this.declarations.join(', ');
        const current = this.laneDeclarations.join(', ');
        if (first === current) return;
        throw new Error(`Lane ${this.lane} of inline ${this.template} declares (${current}) but lane 0 declares ` +
                        `(${first}), all the lanes must declare the same at ${this.sourceRef}`);
    }
    declared(name, type) {
        this.laneDeclarations.push(`${type} ${name}`);
    }
    /**
     * the prefix applies to the name itself, not to the namespace it could be on,
     * air.F declared by an instance with prefix l_ is air.l_F
     */
    getTargetName(name) {
        if (this.prefix === '') return name;
        const index = name.lastIndexOf('.');
        return index < 0 ? this.prefix + name
                         : name.substring(0, index + 1) + this.prefix + name.substring(index + 1);
    }
    /**
     * the lane is the outermost dimension, so each lane keeps its own slice consecutive:
     * col witness v[8] on 4 lanes is v[4][8]
     */
    getTargetLengths(lengths) {
        return this.lanes === false ? lengths : [this.lanes, ...lengths];
    }
    toString() {
        return `[inline ${this.template}${this.prefix === '' ? '' : ' alias ' + this.prefix}` +
               `${this.lanes === false ? '' : '[' + this.lanes + ']'}]`;
    }
}
