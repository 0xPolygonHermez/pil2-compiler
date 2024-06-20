const Exceptions = require('./exceptions.js');
const ExpressionItems = require('./expression_items.js');
const Context = require('./context.js');
const { DefinitionItem } = require('./definition_items.js');
const assert = require('./assert.js');


module.exports = class ExpressionPacker {
    constructor(container = false, expression = false) {
        this.set(container, expression);
    }
    set(container, expression) {
        this.container = container;
        this.expression = expression;
    }
    packAlone(options) {
        this.operandPack(this.expression.getAloneOperand(), 0, options);
        return this.container.pop(1)[0];
    }
    pack(options) {
        if (!this.expression.stack) console.log(this.expression);
        assert.ok(this.expression.stack.length);
        let top = this.expression.stack.length-1;
        return this.stackPosPack(top, options);
    }
    stackPosPack(pos, options) {
        const st = this.expression.stack[pos];
        if (st.op === false) {
            this.operandPack(st.operands[0], pos, options);
            return this.container.insertTop();
        }
        for (const ope of st.operands) {
            this.operandPack(ope, pos, options);
        }
        switch (st.op) {
            case 'mul':
                return this.container.mul();

            case 'add':
                return this.container.add();

            case 'sub':
                return this.container.sub();

            case 'neg':
                return this.container.neg();

            default:
                throw new Exceptions.General(`Invalid operation ${st.op} on packed expression`);
        }
    }

    operandPack(ope, pos, options) {
        if (ope instanceof ExpressionItems.ValueItem) {
            this.container.pushConstant(ope.value);
        } else if (ope instanceof ExpressionItems.ProofItem) {
            this.referencePack(ope, options);
        } else if (ope instanceof ExpressionItems.StackItem) {
            const eid = this.stackPosPack(pos-ope.getOffset(), options);
            if (eid !== false) {        // eid === false => alone operand
                this.container.pushExpression(eid);
            }
        } else {
            const opeType = ope instanceof Object ? ope.constructor.name : typeof ope;
            throw new Exceptions.General(`Invalid reference ${opeType} on packed expression`);
        }

    }
    referencePack(ope, options) {
        // TODO stage expression
        // container.pushExpression(Expression.parent.getPackedExpressionId(id, container, options));
        // break;
        const id = ope.getId();
        const def = Context.references.getDefinitionByItem(ope, options);
        assert.typeOf(def, 'object')
        assert.instanceOf(def, DefinitionItem);
        if (ope instanceof ExpressionItems.WitnessCol) {
            // container.pushWitnessCol(id, next ?? 0, stage ?? 1)
            // CURRENT ERROR: in this scope definition not available.
            this.container.pushWitnessCol(id, ope.getRowOffset(), def.stage);

        } else if (ope instanceof ExpressionItems.FixedCol) {
            // container.pushFixedCol(id, next ?? 0);
            this.container.pushFixedCol(id, ope.getRowOffset());

        } else if (ope instanceof ExpressionItems.Public) {
            // container.pushPublicValue(id)
            this.container.pushPublicValue(id);

        } else if (ope instanceof ExpressionItems.Challenge) {
            // container.pushChallenge(id, stage ?? 1);
            this.container.pushChallenge(id, def.stage);

        } else if (ope instanceof ExpressionItems.Proofval) {
            // container.pushProofValue(id)
            this.container.pushProofValue(id);

        } else if (ope instanceof ExpressionItems.Subproofval) {
            // container.pushSubproofValue(id)
            const def = Context.references.getDefinitionByItem(ope);
//            this.container.pushSubproofValue(def.relativeId, def.subproofId);
            this.container.pushSubproofValue(def.id, def.subproofId);
        } else if (ope instanceof ExpressionItems.ExpressionReference) {
            const defvalue = Context.references.getDefinitionByItem(ope).getValue();
            if (defvalue.isExpression) {
                const packer = new ExpressionPacker(this.container, def.getValue());
                const res = packer.pack(options);
                if (typeof res === 'number') {
                    this.container.pushExpression(res);
                } else {
                    this.container.push(res);
                }
            } else {
                this.referencePack(defvalue, options);
            }
        } else {
            throw new Exceptions.General(`Invalid reference class ${ope.constructor.name} to pack`);
        }
    }
}
