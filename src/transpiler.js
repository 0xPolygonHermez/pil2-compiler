const ExpressionItems = require('./expression_items.js');
const Expression = require('./expression.js');
const Context = require('./context.js');
const { util } = require('chai');
const vm = require('node:vm');
const Performance = require('perf_hooks').performance;

module.exports = class Transpiler {
    constructor(config = {}) {
        this.processor = config.processor;
        this.config = config;
        this.currentScope = {};
        this.scopes = [];
        this.referenceIndex = 0;
        this.context = {};
    }
    transpile(st) {
        console.log(st);
        this.declared = {};
        const code = this.#transpile(st);
        console.log(code);
        const lines = code.split('\n');
        const nlines = lines.map((line, index) => `${(index + 1).toString(10).padStart(4,'0')}: ${line}`);
        console.log('\n'+ nlines.join('\n'));
        // console.log(this.context);

/*
        // console.log('CODE', code);
        let __dbuf = Buffer.alloc(this.size * this.bytes)
        let context = {__dbuf, __dindex: 0};
        let __data; 
        switch (this.bytes) {
            case 1: __data = new Uint8Array(__dbuf.buffer, 0, this.size); break;
            case 2: __data = new Uint16Array(__dbuf.buffer, 0, this.size); break;
            case 4: __data = new Uint32Array(__dbuf.buffer, 0, this.size); break;
            case 8: __data = new BigInt64Array(__dbuf.buffer, 0, this.size); break;
        }
        context.__data = __data;
*/
        vm.createContext(this.context);
        const t1 = Performance.now();
        vm.runInContext(code, this.context);
        const t2 = Performance.now();
        console.log('Execution time: ' + (t2 - t1) + ' milliseconds');  
/*
        this.#values.__setValues(context.__dbuf, context.__data);
        this.#values.mutable = false;*/
        return code;
    }
    #transpile(st) {
        // console.log(st);
        switch(st.type) {
            case 'for': return this.#transpileFor(st);
            case 'code': return this.#transpile(st.statements);
            case 'variable_declaration': return this.#transpileVariableDeclaration(st);
            case 'scope_definition': return this.#transpileScopeDefinition(st);
            case 'expr': return this.#transpileExpr(st);
            case 'switch': return this.#transpileSwitchCase(st);
            case 'assign': return this.#transpileAssign(st);
            case 'if': return this.#transpileIf(st);
        }
        throw new Error(`not known how transpile ${st.type}`);
    }
    #transpileIf(st) {
        let code = '';        
        let first = true;
        // debugger;
        // console.log(util.inspect(st.conditions, { maxArrayLength: null }));
        // for (const cond of st.conditions) {
        //     console.log(JSON.stringify(cond, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        // }
        for (const cond of st.conditions) {
            if (cond.type === 'if') {
                if (first) code += 'if (';
                else code += ' else if (';
                code += this.#toString(cond.expression) + ')';            
            } else if (cond.type === 'else') {
                code += ' else ';
            } else {
                EXIT_HERE;
            }
            code += this.#braces(this.#transpile(cond.statements));            
            first = false;
        }   
        return code;
    }
    #braces(code) {
        if (code.startsWith('{')) {
            return code;
        }
        return '{'+code+'}';
    }
    #toString(obj, options = {}) {
        return obj.toString({...options, intsuffix: 'n', map: (operand, options) => this.#mapping(operand, options)});
    }
    #transpileSwitchCase(st) {
        let code = 'switch ('+this.#toString(st.value)+') {\n';
        let ccases = [];
        for (const _case of st.cases) {
            // console.log(_case);
            if (_case.condition) {
                let cvalues = [];            
                for (const cvalue of _case.condition.values) {
                    cvalues.push(this.#toString(cvalue));
                }
                code += '\n\tcase '+cvalues.join(':\n\tcase ')+':\n';
            } else if (_case.default) {
                code += '\n\tdefault:\n';
            } else {
                console.log(_case);
                EXIT_HERE;
            }
            code += this.#transpile(_case.statements)+';\nbreak;\n';
        }   
        code += '}\n';
        return code;
    }
    #transpileExpr(st) {
        return this.#toString(st.expr);
    }
    #transpileFor(st) {
        let code = '';
        const inits = Array.isArray(st.init) ? st.init : [st.init];
        const cinits = [];
        for (const init of inits) {
            cinits.push(this.#transpile(init));
        }
        const cincrements = [];
        for (const increment of st.increment) {
            cincrements.push(this.#transpile(increment));
        }
        code += 'for ('+cinits.join()+';'+this.#toString(st.condition)+';'+cincrements.join()+')\n';
        code += this.#braces(this.#transpile(st.statements)) + '\n';
        return code;
    }
    #transpileVariableDeclaration(st) {
        let code = '';
        if (st.vtype !== 'string' && st.vtype !== 'int') {
            throw new Error(`declaration type ${st.vtype} not supported on transpilation`);
        }
        // console.log(st.items);
        // console.log(st.init);
        code += st.const ? 'const ':'let ';
        if (st.init) {
            // console.log(st.init instanceof ExpressionItems.ExpressionList);
            const initlen = st.init instanceof ExpressionItems.ExpressionList ? st.init.length : 1;
            if (st.items.length !== initlen) {
                console.log(st.items);
                console.log(st.init.stack);
                throw new Error(`mistmatch lengths ${st.items.length} vs ${initlen}`);            
            }
        }
        
        this.declareInsideTranspilation(st.items.map(x => x.name));
        if (st.items.length === 1) {
            code += st.items[0].name;
        } else {
            code += '[' + st.items.map(x => x.name).join() + ']';
        }
        if (st.init) {
            // console.log(st.init);
            if (st.init.length === 1) {
                code += `=${this.#toString(st.init[0])}`;
            } else if (st.init instanceof ExpressionItems.ExpressionList) {
                const inits = [];
                // console.log(st.init);
                for (const init of st.init.items) {
                    inits.push(this.#toString(init));
                }
                code += '=['+inits.join()+']';
            } else if (st.init instanceof Expression) {
                code += `=${this.#toString(st.init)}`;
            } else {
                EXIT_HERE;
            }
        }
        return code;
    }
    #transpileAssign(st) {
        const ref = st.name;
        const name = ref.name;
        const value = this.#toString(st.value);
        let code = name;
        if (ref.dim) {
            const cindexes = [];
            for (const index of ref.indexes) {
                cindexes.push(this.#toString(index));
            }
            code = code + '['+ cindexes.join('][')+']';
        }
        if (!this.isDeclaredInsideTranspilation(name)) {
            const reference = Context.references.getReference(name, false);
            if (reference) {
                return this.#mappingSetReference(name, reference, code, ref.dim ?? 0, value);
            }
        }
        return code + '=' + value;
    }
    #transpileVariableIncrement(st) {
        if (!st.dim) {
            if (st.pre === 1n) {   
                return '++'+st.name;
            }
            if (st.post === 1n) {   
                return st.name+'++';
            }
        }
        throw new Error(`Traspilation not supported by pre:${st.pre}, post:${st.post}, dim:${dim}`);
    }
    #transpileScopeDefinition(st) {
        let codes = [];
        for (const statement of st.statements) {
            codes.push(this.#transpile(statement));
        }
        return '{'+codes.join(';\n')+'}';
    }
    declareInsideTranspilation(names) {        
        for (const name of names) {
            this.currentScope[name] = true;
        }
    }
    pushScope() {
        this.scopes.push(this.currentScope);
        this.currentScope = {};
    }
    popScope() {
        this.currentScope = this.scopes[this.scopes.length-1];
        this.scopes.pop();
    }
    isDeclaredInsideTranspilation(name) {
        console.log(`\x1B[42m ${name} \x1B[0m`);   
        if (typeof this.currentScope[name] !== 'undefined') {
            return true;
        }
        for (const scope of this.scopes) {
            if (typeof scope[name] !== 'undefined') {
                return true;
            }
        }   
        return false;
    }
    #mapping(operand, options) {
        const name = operand.name;
        const dim = operand.indexes ? operand.indexes.length : 0;
        console.log(operand);
        if (operand instanceof ExpressionItems.StringTemplate) {
            return '`'+ operand.value + '`';
        }
        if (typeof name === 'undefined') {
            console.log(operand);
        } else {
            if (name === 'error') {
                console.log(operand);
            }
            console.log(`\x1B[44m mapping \x1B[0m ${name}`);
        }
        if (this.isDeclaredInsideTranspilation(operand.name)) {
            // TODO: indexes
            return name;
        }
        const result = operand.toString(options);
        if (operand instanceof ExpressionItems.ReferenceItem) {
            console.log(`\x1B[41m OPERAND \x1B[0m ${name}`, operand, result);
            if (this.isDeclaredInsideTranspilation(operand.name)) {
                // TODO: indexes
                return result;
            }
            const reference = Context.references.getReference(name, false);
            if (reference) {
                return this.#mappingGetReference(name, reference, result, dim);
            }
            console.log(reference);
        }
        return result;
    }
    createTranspiledObjectReference(type, name, obj) {
        // TODO: create arrays of references for arrays
        const id = `___ref_${type}_${name}__`;
        if (typeof this.context[id] === 'undefined') {
            this.context[id] = obj;
        }
        return id;
    }
    #mappingGetReference(name, reference, result, dim) {
        const isFixed = reference.instance.type === 'fixed';
        if (isFixed) {
            if (dim === 1) {
                const indexes = this.#extractIndexes(result);
                let tref = this.createTranspiledObjectReference('fixed', name, reference.instance.getItem(reference.locator).definition);    
                return tref+`.getRowValue(Number(${indexes.slice(1,-1)})).asInt()`
                // return `getFixed('${name}'`+ (indexes === false ? ')':`,${indexes})`);
            }
        }
        const isInt = reference.instance.type === 'int';
        if (!isFixed && !isInt) {
            throw new Error(`not supported (get) reference type ${reference.instance.type}`);
        }

        if (isInt && (reference.const || reference.name === 'N')) {
            return reference.instance.get(reference.locator).getValue() + 'n';
        }
        return `getReference('${name}','${reference.instance.type}','${reference.locator}')`;
    }
    #mappingSetReference(name, reference, result, dim, value) {
        const isFixed = reference.instance.type === 'fixed';
        if (isFixed) {
            if (dim === 1) {
                const indexes = this.#extractIndexes(result);
                let tref = this.createTranspiledObjectReference('fixed', name, reference.instance.getItem(reference.locator).definition);    
                return tref+`.setRowValue(Number(${indexes.slice(1,-1)}), ${value})`
            }
        }
        const isInt = reference.instance.type === 'int';
        if (!isFixed && !isInt) {
            throw new Error(`not supported (set) reference type ${reference.instance.type}`);
        }

        return `setReference('${name}','${reference.instance.type}','${reference.locator}, ${value})`;
    }
    #extractIndexes(result) {
        if (typeof result === 'string') {
            const pos = result.indexOf('[');
            if (pos >= 0) {
                return result.substring(pos);
            }
        }
        return false;
    }
}