const Definitions = require("./definitions.js");
const Airs = require("./airs.js");
const Air = require("./air.js")
const Context = require('./context.js');
const Function = require('./function.js');
module.exports = class Subproof extends Function {

    constructor (id, data = {}) {
        // TODO: when instance a subproof return an integer (as a handler id)
        super(id, data);
        // rows, statements, aggregate
        this.airs = new Airs(this);
        this.aggregate = data.aggregate ? true : false;
        this.insideFirstAir = false;
        this.spvDeclaredInFirstAir = {};
        this.spvDeclaredInsideThisAir = {};
        this.insideAir = false;
    }
    addBlock(statements) {
        this.statements = [...this.statemens, ...statements];
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
            /* const spvNonDeclared = Object.keys(this.spvDeclaredInsideThisAir).filter(name => this.spvDeclaredInsideThisAir[name] === false);
            console.log(spvNonDeclared);
            for (const name of spvNonDeclared) {
                console.log(Context.references.getReference(name));
                console.log(Context.references.getReference(name+'__'));
                // console.log(spvNonDeclared, Context.airName);
                // throw new Error(``);
            }*/
        }
        this.insideFirstAir = false;
        this.insideAir = false;
    }
    declareSubproofvalue(name, lengths = [], data = {}) {
        // colDeclaration(s, type, ignoreInit, fullName = true, data = {}) {
        if (!this.insideAir) {
            throw new Error(`Subproofvalue ${name} must be declared inside subproof (air)`);
        }
        if (this.insideFirstAir) {
            // this.colDeclaration(s, 'subproofvalue', true, false, {aggregateType: s.aggregateType});
            const res = Context.references.declare(name, 'subproofvalue', lengths, data);
            this.spvDeclaredInFirstAir[name] = {res, lengths: [...lengths]};
            return res;
        }

        // insideFirsAir = false. Check subproofvalue it's same declared on first air "execution"
        const previousLengths = (this.spvDeclaredInFirstAir[name] ?? {lengths: false}).lengths;
        if (previousLengths === false) {
            throw new Error(`Subproofvalue ${name} not declared on first air execution`);
        }
        const sameLengths = previousLengths.length === lengths.length && previousLengths.every((length, index) => lengths[index] === length);
        if (!sameLengths) {
            throw new Error(`Subproofvalue ${name} has different index lengths [${previousLengths.join('][')}] declared than now [${lengths.join('][')}]`);
        }

        // mark this subproof value as declared
        this.spvDeclaredInsideThisAir[name] = true;

        return this.spvDeclaredInFirstAir[name].res;
    }
}
