const { log2 } = require("./utils.js");
const Context = require('./context.js');

module.exports = class Air {
    constructor (id, airGroup, airTemplate, rows, options = {}) {
        this.id = id;
        this.airGroup = airGroup;
        this.airTemplate = airTemplate;
        this.rows = Number(rows);
        this.bits = log2(this.rows);
        this.name = (options.name ?? airTemplate.name) ?? '';
    }
    declareAirValue(name, lengths = [], data = {}) {
        const fullname = Context.getFullName(name);
        const insideAirContainer = Context.references.getContainerScope() === 'air';
        const res = Context.references.declare(fullname, 'airvalue', lengths, data);
        return res;
    }
}
