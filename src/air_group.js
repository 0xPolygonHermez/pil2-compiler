const Definitions = require("./definitions.js");
// const Airs = require("./airs.js");
const Air = require("./air.js")
const Context = require('./context.js');
const {FlowAbortCmd, BreakCmd, ContinueCmd, ReturnCmd} = require("./flow_cmd.js");
const ExpressionItems = require('./expression_items.js');
module.exports = class AirGroup {
    constructor (name, statements, aggregate) {
        // TODO: when instance a airgroup return an integer (as a handler id)
        this.id = false;
        this.airs = [];
        this.aggregate = aggregate;
        this.name = name;
        this.blocks = [statements];

        this.insideFirstAir = false;
        this.spvDeclaredInFirstAir = {};
        this.spvDeclaredInsideThisAir = {};
        this.insideAir = false;
    }
    getId(id) {
        return this.id;
    }
    setId(id) {
        this.id = id;
    }
    createAir(rows, options = {}) {
        const id = this.airs.length;
        const name = options.name ??  (this.name + (id ? `_${id}`:''));
        const air = new Air(id, rows, {...options, name});
        this.airs.push(air);
        return air;
    }
    addBlock(statements) {
        this.statements = [...this.statements, ...statements];
    }
    airStart() {
        this.insideAir = true;
        this.insideFirstAir = (this.airs.length === 1);
        if (!this.insideFirstAir) {
            this.spvDeclaredInsideThisAir = Object.fromEntries(Object.keys(this.spvDeclaredInFirstAir).map(x => [x,false]));
        }
    }
    airEnd() {
        if (!this.insideFirstAir) {
            const spvNonDeclared = Object.keys(this.spvDeclaredInsideThisAir).filter(name => this.spvDeclaredInsideThisAir[name] === false);
            for (const name of spvNonDeclared) {
                if (this.spvDeclaredInFirstAir[name].insideAirGroupContainer) continue;
                throw new Error(`airgroupval ${name} declared on previous ${this.name} instance, isn't declared on current air instance`);
            }
        }
        this.insideFirstAir = false;
        this.insideAir = false;
    }
    declareAirGroupValue(name, lengths = [], data = {}) {
        // colDeclaration(s, type, ignoreInit, fullName = true, data = {}) {
        const fullname = Context.getFullName(name);
        const insideAirGroupContainer = Context.references.getContainerScope() === 'airgroup';
        if (!this.insideAir) {
            throw new Error(`airgroupval ${name} must be declared inside airgroup (air)`);
        }
        if (this.insideFirstAir) {
            // this.colDeclaration(s, 'airgroupvalue', true, false, {aggregateType: s.aggregateType});
            const res = Context.references.declare(fullname, 'airgroupvalue', lengths, data);
            this.spvDeclaredInFirstAir[name] = {res, lengths: [...lengths], insideAirGroupContainer};
            return res;
        }

        // insideFirsAir = false. Check airgroupval it's same declared on first air "execution"
        const previousLengths = (this.spvDeclaredInFirstAir[name] ?? {lengths: false}).lengths;
        if (previousLengths === false) {
            throw new Error(`airgroupval ${name} not declared on first air execution`);
        }
        const sameLengths = previousLengths.length === lengths.length && previousLengths.every((length, index) => lengths[index] === length);
        if (!sameLengths) {
            throw new Error(`airgroupval ${name} has different index lengths [${previousLengths.join('][')}] declared than now [${lengths.join('][')}]`);
        }

        // mark this airgroupval as declared
        this.spvDeclaredInsideThisAir[name] = true;

        return this.spvDeclaredInFirstAir[name].res;
    }
    exec(callInfo, mapInfo) {
        let res = false;
        for (const statements of this.blocks) {
            // REVIEW: clear uses and regular expressions
            // this.scope.push();
            res = Context.processor.execute(statements, `AIRGROUP ${this.name}`);
            if (res instanceof FlowAbortCmd) {
                assert.instanceOf(res, ReturnCmd);
                Context.processor.traceLog('[TRACE-BROKE-RETURN]', '38;5;75;48;5;16');
                res = res.reset();
            }
        }
        return (res === false || typeof res === 'undefined') ? new ExpressionItems.IntValue(0) : res;
    }   
}
