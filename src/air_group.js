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
    createAir(airTemplate, rows, options = {}) {
        const id = this.airs.length;
        const air = airTemplate.instance(id, this, rows, options);
        this.airs.push(air);
        return air;
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
                const airGroupValue = this.spvDeclaredInFirstAir[name];
                if (airGroupValue.insideAirGroupContainer) continue;
                if (airGroupValue.data.defaultValue !== false) {
                    this.defineAirGroupValueDefaultConstraints(airGroupValue);
                    continue;
                }
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
            const res = Context.references.declare(fullname, 'airgroupvalue', lengths, data);
            const definition = Context.references.get(fullname);
            const reference = Context.references.getReference(fullname);
            this.spvDeclaredInFirstAir[name] = {res, definition, reference, lengths: [...lengths], insideAirGroupContainer, data};
            return res;
        }

        // insideFirsAir = false. Check airgroupval it's same declared on first air "execution"
        const previous = this.spvDeclaredInFirstAir[name] ?? false;
        if (previous === false) {
            throw new Error(`airgroupval ${name} not declared on first air execution`);
        }
        const sameLengths = previous.lengths.length === lengths.length && previous.lengths.every((length, index) => lengths[index] === length);
        if (!sameLengths) {
            throw new Error(`airgroupval ${name} has different previous index lengths [${previous.lengths.join('][')}] declared at ${previous.data.sourceRef} than now [${lengths.join('][')}] at ${data.sourceRef}`);
        }

        if (previous.data.aggregateType !== data.aggregateType) {
            throw new Error(`airgroupval ${name} has different previous aggregation type '${previous.data.aggregateType}' declared at ${previous.data.sourceRef} than now '${data.aggregateType}' at ${data.sourceRef}`);

        }

        if (previous.data.stage != data.stage) {
            throw new Error(`airgroupval ${name} has different previous stage ${previous.data.stage} declared at ${previous.data.sourceRef} than now ${data.stage} at ${data.sourceRef}`);
        }

        if (previous.data.defaultValue !== data.defaultValue) {
            const previousDefaultValue = previous.data.defaultValue === false ? '(no specified)': previous.data.defaultValue;
            const dataDefaultValue = data.defaultValue === false ? '(no specified)': data.defaultValue;
            throw new Error(`airgroupval ${name} has different previous defaultValue ${previousDefaultValue} declared at ${previous.data.sourceRef} than now ${dataDefaultValue} at ${data.sourceRef}`);
        }

        // mark this airgroupval as declared
        this.spvDeclaredInsideThisAir[name] = true;

        return this.spvDeclaredInFirstAir[name].res;
    }
    defineAirGroupValueDefaultConstraints(airGroupValue) {
        const reference = airGroupValue.reference;
        const size = reference.getArraySize();
        const defaultValue = new ExpressionItems.IntValue(airGroupValue.definition.defaultValue);
        if (size === 0) {
            Context.processor.defineConstraint(reference.getItem(), defaultValue);
            return;
        }
        // define a constraint for each item in the array
        for (let nth = 0; nth < size; ++nth) {
            Context.processor.defineConstraint(reference.getNthItem(nth), defaultValue);
        }
    }
}
    