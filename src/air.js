const { log2, getKs, getRoots } = require("./utils.js");

module.exports = class Air {

    constructor (id, rows, options = {}) {
        this.id = id;
        this.rows = Number(rows);
        this.bits = log2(this.rows);
        this.name = options.name ?? '';
    }
}
