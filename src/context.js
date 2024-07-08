const assert = require('./assert.js');
module.exports = class Context {
    static _instance = null;

    constructor (Fr, processor, config = {}) {
        assert.equal(Context._instance, null);
        Context._instance = this;
        this.Fr = Fr;
        this._processor = processor;
        this.namespace = '';
        this.airGroup = false;
        this.stack = [];        
        this.config = {debug: {}, test: {}, ...config};
        this.uses = [];
        this._airGroupName = false;
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
    static get airGroupName() {
        return this._instance._airGroupName;
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
        if (this._aigGroupName) {
            return `AIRGROUP:${this._airGroupName}`;
        }
        return 'PROOF';
    }
    static applyTemplates(value) {
        return this._instance.applyTemplates(value);
    }
    static getFullName(name) {
        return this._instance._getFullName(name);
    }
    setNamespace(namespace, airGroup) {
        this.namespace = namespace;
        if (typeof airGroup !== 'undefined') {
            this.airGroup = airGroup;
        }
    }
    getAirGroup() {
        return this.airGroup;
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
        const regex = /((?<airgroup>\w*)::)?((?<namespace>\w*)\.)?(?<name>\w+)/gm;

        let m;

        while ((m = regex.exec(name)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            return [m.groups.airgroup, m.groups.namespace, m.groups.name];
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
        if (parts.length === 1 && this.airGroup !== false && this.airGroup !== '') {
            name = this.airGroup + '.' + name;
        }
        return name;
    }
    push(namespace, airGroup) {
        this.stack.push([this.airGroup, this.namespace]);
        this.setNamespace(namespace, airGroup);
    }
    pop() {
        [this.airGroup, this.namespace] = this.stack.pop();
    }
}
