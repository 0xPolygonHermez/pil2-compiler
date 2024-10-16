const util = require('util');
const {cloneDeep} = require('lodash');
const Expression = require("./expression.js");
const {ReferenceItem, IntValue, StringValue, StringTemplate,
    FunctionCall, ExpressionList, RangeIndex} = require("./expression_items.js");
const Router = require("./router.js");
const RowOffset = require('./expression_items/row_offset.js');
const Context = require('./context.js');
const Debug = require('./debug.js');
const assert = require('./assert.js');
module.exports = class ExpressionFactory {

    // pre function to delete property op only used by routing
    static router = new Router(this, 'type', {defaultPrefix: '_from', pre: (method, obj) => delete obj.type});

    static fromObject(obj) {
        try {
            return this._fromObject(obj);
        } catch (e) {
            // console.log(e);
            if (e.message.startsWith(Context.processor.sourceRef + ':') === false) {
                e.message = Context.processor.sourceRef + ': ' + e.message;
            }
            throw e; // new Error();
        }
    }
    static _fromObject(obj, options = {}) {        
        if (obj instanceof Expression) {
            // console.log('#########', Object.keys(obj).includes('type'));
            return obj;
        }
        // console.log(obj);
        assert.typeOf(obj, 'object');
        assert.typeOf(obj.op, 'undefined');
        if (Array.isArray(obj)) {
            obj = [...obj];
        } else {
            obj = {...obj};
        }

        assert.notStrictEqual(obj.type, 'object');
        assert.notStrictEqual(obj.type, 'objects');
        if (obj.dim === 0) delete obj.dim;

        // console.log(obj);
        const type = obj.type;
        if (typeof type === 'undefined') {
            console.log(obj);
        }
        let item = ExpressionFactory.router.go(obj);

        let unknownProperties = [];
        for (const prop in obj) {
            if (prop.startsWith('__')) continue;
            if (prop === 'debug') continue;
            unknownProperties.push(prop);
        }

        if (unknownProperties.length > 0) {
            console.log(obj);
            throw new Error(`Invalid properties: ${unknownProperties.join(',')} / ${type} on ${obj.debug}`);
        }
        if (type === 'row_offset') {
            return item;
        }
        if (item instanceof ExpressionList) {
            return item;
        }
        let expr = new Expression();
        expr._set(item);
        return expr;
    }
    static _fromObjects(objs, options = {}) {
        let expressions = [];
        for (const obj of objs) {
            // if (Array.isArray(obj) && options.elist) {
            if (Array.isArray(obj)) {
                // TODO: review, better values
                expressions.push(ExpressionFactory._fromExpressionList(obj));
                // expressions.push(new ExpressionList(this._fromObjects(obj, {elist: true})));
                continue;
            }
            if (obj instanceof Expression || obj instanceof ExpressionList) {
                expressions.push(obj);
                continue;
            }
            expressions.push(ExpressionFactory._fromObject(obj, options));
        }
        return expressions;
    }
    static _fromExpressionList(obj) {
        if (Debug.active) console.log(obj.values);
        if (Debug.active) console.log(obj.__debug);
        let options = {};
        if (obj.names) {
            options.names = obj.names;
        }
        const elist = new ExpressionList(this._fromObjects(obj.values, {elist: true}), options);
        if (Debug.active) console.log(elist);
        delete obj.values;
        delete obj.names;
        return elist;
    }
    static _fromAppend(obj) {
        console.log('TODO !!! ');
        console.log(util.inspect(obj, false, null));
        let res = this._fromObject(obj.value);
        res.transform = 'spread';
        delete obj.value;
        res.dump();
        EXIT_HERE;
        return res;
    }
    static _fromReference(obj) {
        // if (obj.rowOffset) {
        //     console.log('ROWOFFSET.FROMREFERENCE');
        //     console.log(obj.rowOffset);
        // }
        // console.log(obj);
        let res = new ReferenceItem(obj.name, obj.indexes ?? [], obj.rowOffset);
        delete obj.name;
        delete obj.indexes;
        delete obj.dim;
        delete obj.rowOffset;

        // TODO
        delete obj.inc;
        return res;
    }
    static _fromNumber(obj) {
        let res = new IntValue(obj.value);
        delete obj.value;
        return res;
    }
    static _fromString(obj) {
        let res;
        if (obj.template) {
            res = new StringTemplate(obj.value);
            delete obj.template;
        }
        else {
            res = new StringValue(obj.value);
        }
        delete obj.value;
        return res;
    }
    static _fromCall(obj) {
        // console.log(`##### CALL ${obj.function.name} ${obj.debug}`);
        // console.log(util.inspect(obj, false, 10, true));
        let res = new FunctionCall(obj.function.name, obj.args ?? [], obj.indexes ?? [], {
            name: obj.function.name.debug});
        // console.log(res);
        delete obj.function;
        delete obj.indexes;
        delete obj.dim;
        delete obj.args;
        return res;
    }
    static _fromCast(obj) {
        let res = new FunctionCall('cast', [new StringValue(obj.cast), obj.value], []);
        delete obj.name;
        delete obj.cast;
        delete obj.value;
        // console.log(res);
        return res;
    }
    static _fromRowOffset(obj) {
        if (obj.current && obj.current.rowOffset) {
            // TODO: ERROR more than rowOffset for same element.
            EXIT_HERE;
        }
        let res = RowOffset.factory(obj.value, obj.prior ?? false);
        delete obj.current;
        delete obj.value;
        delete obj.prior;
        // console.log(res);
        return res;
    }
    static _fromRangeIndex(obj) {
        const from = obj.from ?? false;
        const to = obj.to ?? false;        
        delete obj.from;
        delete obj.to;
        return new RangeIndex(from, to);
    }
    // TODO: positionalParams
}
