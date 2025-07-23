const { log2 } = require("./utils.js");
const Context = require('./context.js');
const FixedFile = require('./fixed_file.js');
const ExternFixedFile = require('./extern_fixed_file.js');
const path = require('path');
module.exports = class Air {
    static _airnames = {};
    constructor (id, airGroup, airTemplate, rows, options = {}) {
        this.id = id;
        this.airGroup = airGroup;
        this.airTemplate = airTemplate;
        this.rows = Number(rows);
        this.bits = log2(this.rows);
        this.name = (options.name ?? airTemplate.name) ?? '';
        this.loadFixedFiles = {};
        const previousNameIsUsed = Air._airnames[this.name];
        if (typeof previousNameIsUsed !== 'undefined') {
            throw new Error(`Air name ${this.name} on ${Context.sourceRef} already exists on ${previousNameIsUsed}`);
        }
        Air._airnames[this.name] = Context.sourceRef;
        this.outputFixedFile = Context.config.fixedToFile ? this.name + '.fixed' : false;
        this.externFixedFiles = [];
    }
    declareAirValue(name, lengths = [], data = {}) {
        const fullname = Context.getFullName(name);
        const insideAirContainer = Context.references.getContainerScope() === 'air';
        const res = Context.references.declare(fullname, 'airvalue', lengths, data);
        return res;
    }
    setOutputFixedFile(filename) {
        if (typeof filename !== 'string') {
            throw new Error(`Invalid fixed file name ${filename} on ${Context.sourceRef}`);
        }
        this.outputFixedFile = filename;
    }
    // Unused function to define a load fixed column, to allow load all fixed file columns together
    defineLoadFixedFile(filename, col, values) {
        let fixedFile = this.loadFixedFiles[filename];
        if (!fixedFile) {
            fixedFile = new FixedFile([], this.rows);
            this.loadFixedFiles[filename] = fixedFile;
        }
        fixedFile.defineCol(col, values);
    }
    // Unused function to load all fixed file columns together
    loadFiledFiles() {
        for (const [filename, fixedFile] of Object.entries(this.loadFixedFiles)) {            
            console.log(`  > Loading fixed file ${filename} ...`);
            fixedFile.loadFromFile(filename);
        }
    }
    loadExternFixedFile(filename) {
        if (typeof filename !== 'string') {
            throw new Error(`Invalid extern fixed file name ${filename} on ${Context.sourceRef}`);
        }
        console.log(`  > Loading extern fixed file ${filename} ...`);
        // console.log(Context.processor);
        // console.log(Context);
        this.externFixedFiles.push(new ExternFixedFile(filename, {...Context.config, fileDir: path.join(Context.basePath, path.dirname(Context.sourceRef)), basePath: Context.basePath}));
    }
    findExternFixedCol(colname) {
        let data = false;
        for (const eff of this.externFixedFiles) {
            data = eff.getColByName(colname);
            if (data !== false) break;
        }
        return data;
    }
}
