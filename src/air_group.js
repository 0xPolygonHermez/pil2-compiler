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
        this.airGroupValues = {};

        this.insideFirstAir = false;
        this.spvDeclaredInFirstAir = {};
        this.spvDeclaredInsideThisAir = {};
        this.openedAirIds = 0;
    }
    end() {
        for (let airId = 0; airId < this.airs.length; ++airId) {   
            this.checkAirGroupValues(airId);
        }   
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
    airStart(airId) {
        console.log(`****************** AIR_START ${airId} *********************** ${this.openedAirIds}`);
        ++this.openedAirIds;
    }
    airEnd(airId) {
        console.log(`****************** AIR_END ${airId} *********************** ${this.openedAirIds}`);
        this.checkAirGroupValues(airId);
        --this.openedAirIds;
    }
    checkAirGroupValues(airId) {
        for (const name in this.airGroupValues) {
            const airGroupValue = this.airGroupValues[name];    
            console.log(airGroupValue);

            // TODO: verify case
            if (airGroupValue.insideAirGroupContainer) continue;
        
            if (typeof airGroupValue.airs[airId] === 'undefined') {
                if (airGroupValue.data.defaultValue !== false) {
                    console.log(airId);                    
                    this.defineAirGroupValueDefaultConstraints(airGroupValue);
                    airGroupValue.airs[airId] = true;
                    continue;
                }
                throw new Error(`airgroupval ${name} declared on previous ${this.name} instance, isn't declared on current air instance`);
            }
        }
    }
    checkSameAirGroupValueDeclaration(airGroupValue, name, lengths, data) {
        // check array dims and lengths
        const sameLengths = airGroupValue.lengths.length === lengths.length && airGroupValue.lengths.every((length, index) => lengths[index] === length);
        if (!sameLengths) {
            throw new Error(`airgroupval ${name} has different previous index lengths [${airGroupValue.lengths.join('][')}] declared at ${airGroupValue.data.sourceRef} than now [${lengths.join('][')}] at ${data.sourceRef}`);
        }

        // check aggretation type
        if (airGroupValue.data.aggregateType !== data.aggregateType) {
            throw new Error(`airgroupval ${name} has different previous aggregation type '${airGroupValue.data.aggregateType}' declared at ${airGroupValue.data.sourceRef} than now '${data.aggregateType}' at ${data.sourceRef}`);
        }

        // check state
        if (airGroupValue.data.stage != data.stage) {
            throw new Error(`airgroupval ${name} has different previous stage ${airGroupValue.data.stage} declared at ${airGroupValue.data.sourceRef} than now ${data.stage} at ${data.sourceRef}`);
        }

        // check default value
        if (airGroupValue.data.defaultValue !== data.defaultValue) {
            const previousDefaultValue = airGroupValue.data.defaultValue === false ? '(no specified)': airGroupValue.data.defaultValue;
            const dataDefaultValue = data.defaultValue === false ? '(no specified)': data.defaultValue;
            throw new Error(`airgroupval ${name} has different previous defaultValue ${previousDefaultValue} declared at ${airGroupValue.data.sourceRef} than now ${dataDefaultValue} at ${data.sourceRef}`);
        }
    }
    declareAirGroupValue(name, lengths, data, airId) {
        // colDeclaration(s, type, ignoreInit, fullName = true, data = {}) {
        const fullname = Context.getFullName(name);
        const insideAirGroupContainer = Context.references.getContainerScope() === 'airgroup';
        if (this.openedAirIds <= 0) {
            throw new Error(`airgroupval ${name} must be declared inside airgroup (air)`);
        }

        const airGroupValue = this.airGroupValues[name] ?? false;
        if (typeof airGroupValue !== 'undefined') {
            const res = Context.references.declare(fullname, 'airgroupvalue', lengths, data);
            const definition = Context.references.get(fullname);
            const reference = Context.references.getReference(fullname);
            const _airGroupValue = {res, name, definition, reference, lengths: [...lengths], insideAirGroupContainer, data, airs: []};
            _airGroupValue.airs[airId] = Context.sourceRef;
            this.airGroupValues[name] = _airGroupValue;
            return res;
        }
        this.checkSameAirGroupValueDeclaration(airGroupValue, name, lengths, data);
        airGroupValue.airs[airId] = Context.sourceRef;
        return airGroupValue.res;
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
    