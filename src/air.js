const { log2 } = require("./utils.js");

module.exports = class Air {
    constructor (id, airGroup, airTemplate, rows, options = {}) {
        this.id = id;
        this.airGroup = airGroup;
        this.airTemplate = airTemplate;
        this.rows = Number(rows);
        this.bits = log2(this.rows);
        this.name = (options.name ?? airTemplate.name) ?? '';
    }
}
