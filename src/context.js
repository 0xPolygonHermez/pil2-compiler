const assert = require('./assert.js');
module.exports = class Context {
    static _instance = null;

    constructor (Fr, processor, config = {}) {
        assert.equal(Context._instance, null);
        Context._instance = this;
        this.Fr = Fr;
        this._processor = processor;
        this.namespace = '';
        this.subproof = false;
        this.stack = [];        
        this.config = {debug: {}, test: {}, ...config};
        this.uses = [];
        this._subproofName = false;
        this.airId = false;
        this.airN = false;
        if (typeof this.config.test.onContextInit === 'function') {
            this.config.test.onContextInit(Context, this);
        }
    }
    static get Fr() {
        return this._instance.Fr;
    }
    static get config() {
        return this._instance.config;
    }
    static get subproofName() {
        return this._instance._subproofName;
    }
    static get expressions() {
        return this._instance._processor.expressions;
    }
    static get runtime() {
        return this._instance._processor.runtime;
    }
    static get scope() {
        return this._instance._processor.scope;
    }
    static get sourceRef() {
        return this._instance._processor.sourceRef;
    }
    static get sourceTag() {
        return this._instance._processor.sourceRef.split('/').slice(-2).join('/');
    }
    static get processor() {
        return this._instance._processor;
    }
    static get current() {
        return this._instance;
    }
    static get references() {
        return this._instance._processor.references;
    }
    static get proofLevel() {
        if (this.airName) {
            return `AIR:${this.airName}`;
        }
        if (this._subproofName) {
            return `SUBPROOF:${this._subproofName}`;
        }
        return 'PROOF';
    }
    static applyTemplates(value) {
        return this._instance.applyTemplates(value);
    }
    static getFullName(name) {
        return this._instance._getFullName(name);
    }
    setNamespace(namespace, subproof) {
        this.namespace = namespace;
        if (typeof subproof !== 'undefined') {
            this.subproof = subproof;
        }
    }
    getSubproof() {
        return this.subproof;
    }
    getNamespace() {
        return this.namespace;
    }
    addUses(scope) {
        this.uses.push(scope);
    }
    clearUses() {
        this.uses = [];
    }
    applyTemplates(value) {
        if (!value.includes('${')) return value;
        return this._processor.evaluateTemplate(value);
    }
    getNames(name) {
        if (typeof name.name !== 'undefined') {
            console.log(name);
            throw new Error('Invalid name used on getNames');
        }

        let names = name;
        if (typeof name === 'string') {
            names = [name];
        }
        names = names.map(name => this.applyTemplates(name));
        if (!Array.isArray(names) || names.length !== 1) {
            return names;
        }
        name = names[0];
        const fullName = this._getFullName(name);
        return name === fullName ? [name]:[name, fullName];
    }
    decodeName(name) {
        const regex = /((?<subproof>\w*)::)?((?<namespace>\w*)\.)?(?<name>\w+)/gm;

        let m;

        while ((m = regex.exec(name)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            return [m.groups.subproof, m.groups.namespace, m.groups.name];
        }
    }
    _getFullName(name) {
        if (typeof name !== 'string') {
            console.log(name);
            throw new Error(`getFullName invalid argument`);
        }
        name = this.applyTemplates(name);
        if (this._processor.references.insideContainer) {
            return name;
        }

        const parts = name.split('.');
        if (parts.length === 1 && this.subproof !== false && this.subproof !== '') {
            name = this.subproof + '.' + name;
        }
        return name;
    }
    push(namespace, subproof) {
        this.stack.push([this.subproof, this.namespace]);
        this.setNamespace(namespace, subproof);
    }
    pop() {
        [this.subproof, this.namespace] = this.stack.pop();
    }
}
