const { log2 } = require("./utils.js");
const Context = require('./context.js');

module.exports = class Air {
    static _airnames = {};
    constructor (id, airGroup, airTemplate, rows, options = {}) {
        this.id = id;
        this.airGroup = airGroup;
        this.airTemplate = airTemplate;
        this.rows = Number(rows);
        this.bits = log2(this.rows);
        this.name = (options.name ?? airTemplate.name) ?? '';
        const previousNameIsUsed = Air._airnames[this.name];
        if (typeof previousNameIsUsed !== 'undefined') {
            throw new Error(`Air name ${this.name} on ${Context.sourceRef} already exists on ${previousNameIsUsed}`);
        }
        Air._airnames[this.name] = Context.sourceRef;
    }
}
