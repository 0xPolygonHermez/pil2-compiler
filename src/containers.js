const assert = require('./assert.js');
const Context = require('./context.js');
module.exports = class Containers {
    constructor (parent) {
        this.parent = parent;
        this.containers = {};
        this.current = false;
        this.uses = [];
        this.aliases = [];
    }
    addScopeAlias(alias, value) {
        // NOTE: there is no need to check for aliases because by grammatical definition,
        // aliases must be an identifier

        if (this.aliases[alias]) {
            throw new Error(`Alias ${alias} already defined on ${this.aliases[alias].sourceRef}`);
        }

        Context.scope.addToScopeProperty('aliases', alias);
        this.aliases[alias] = {container: value, sourceRef: Context.sourceRef};
    }
    getAlias(alias, defaultValue) {
        return this.aliases[alias] ?? defaultValue;
    }
    getFromAlias(alias, defaultValue) {
        return this.getAlias(alias, {container: defaultValue}).container;
    }
    unsetAlias(aliases) {
        for (const alias of aliases) {
            assert.defined(this.aliases[alias]);
            delete this.aliases[alias];
        }
    }
    unsetUses(uses) {
        let count = uses.length;
        while (count > 0) {
            const use1 = this.uses.pop();
            const use2 = uses.pop();
            assert.equal(use1, use2);
            --count;
        }
    }
    unsetProperty(property, values) {
        switch (property) {
            case 'aliases': return this.unsetAlias(values);
            case 'uses': return this.unsetUses(values);
        }
        throw new Error(`unsetProperty was called with invalid property ${property}`);
    }
    clearScope(proofScope) {
        // const previousScopes = Object.keys(this.containers).map(name => `${name}(${this.containers[name].scope})`).join();
        const _containers = Object.keys(this.containers).map(name => [name, this.containers[name].scope]);
        this.containers = Object.keys(this.containers)
            .filter(name => this.containers[name].scope !== proofScope)
            .reduce((containers, name) => { containers[name] = this.containers[name]; return containers; }, {});
        // console.log(`clearScope(Container) ${proofScope}: ` + _containers.filter(c => typeof this.containers[c[0]] === 'undefined').map(c => `${c[0]}(${c[1]})`).join(', '));
    }
    create(name, alias = false)
    {
        if (this.current !== false) {
            throw new Error(`Container ${this.current} is open, must be closed before start new container`);
        }

        // console.log(`createContainer(${name},${alias}) at ${Context.sourceRef}`);
        // if container is defined, contents is ignored but alias must be defined
        if (alias) {
            this.addScopeAlias(alias, name);
        }

        // console.log(`CREATE CONTAINER ${name}`);
        // if container is defined, contents is ignored
        if (this.containers[name]) {
            return false;
        }

        // const nameInfo = this.decodeName(name).scope;    
        this.containers[name] = {scope: this.parent.getNameScope(name), alias, references: {}};
        // console.log(this.containers[name]);
        this.current = name;
        return true;
    }
    inside() {
        return this.current;
    }
    getCurrent() {
        return this.current;
    }
    close(){
        this.current = false;
    }
    isDefined(name) {
        return (this.containers[name] ?? false) !== false;
    }
    get (name) {
        return this.containers[name] ?? false;
    }
    addReference(name, reference) {
        if (this.current === false) {
            throw new Error(`Could add reference ${name} to closed container`);
        }
        const container = this.containers[this.current];
        // console.log(this.containers);
        // console.log(this.current);
        if (container.references[name]) {
            throw new Error(`Reference ${name} was declared previously on scope ${this.current}`);
        }
        container.references[name] = reference;
    }
    addUse(name) {
        if (!this.containers[name]) {
            // TODO: defined must be check containers
            throw new Error(`Use not created container ${name}`);
        }
        Context.scope.addToScopeProperty('uses', name);
        this.uses.push(name);
    }
    getReferenceInside(container, name, defaultValue) {
        return this.#getReference(name, defaultValue, container, false);
    }
    getReferenceInsideCurrent(name, defaultValue) {
        return this.#getReference(name, defaultValue, this.current, false);

    }
    getReference(name, defaultValue) {
        return this.#getReference(name, defaultValue, this.current, true);
    }
    #getReference(name, defaultValue, container, uses) {
        // first search on specific container
        let reference = false;
        if (container) {
            reference = this.containers[container].references[name] ?? false;
        }
        // if not found check other counters indicate with use
        let usesIndex = this.uses.length;
        while (!reference && usesIndex > 0) {
            --usesIndex;
            reference = this.containers[this.uses[usesIndex]].references[name] ?? false;
        }
        return reference ? reference : defaultValue;
    }
    *[Symbol.iterator]() {
        for (let name in this.containers) {
          yield name;
        }
    }
}
