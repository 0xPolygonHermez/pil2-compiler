const Generic = require('./exceptions/generic.js');
const CannotBeCastToType = require('./exceptions/cannot_be_cast_to_type.js');
const ReferenceNotFound = require('./exceptions/reference_not_found.js');
const ReferenceNotVisible = require('./exceptions/reference_not_visible.js');
const Internal = require('./exceptions/internal.js');
const Expression = require('./exceptions/expression.js');
const ExpressionItem = require('./exceptions/expression_item.js');
const Statement = require('./exceptions/statement.js');
class Assert extends Generic {
    constructor (message, options) {super('ASSERT: '+message, options)}
}

class Array extends Generic {};
class NonNativeOperations extends Generic {};
class ReferenceAlreadyDeclared extends Generic {};
class ClosedContainer extends Generic {};
class AliasAlreadyDeclared extends Generic {};
class AliasStillOpen extends Generic {};
class ContainerNotFound extends Generic {};
class AlreadyDefined extends Generic {};
class ExpressionBuild extends Expression {};
class ExpressionEvaluation extends Expression {};
class Sequence extends Generic {};
class Syntax extends Generic {};
class Proto extends Generic {};

const Exceptions = {
    Generic,
    Internal,
    Assert,
    Array,
    CannotBeCastToType,
    ReferenceNotFound,
    ReferenceNotVisible,
    NonNativeOperations,
    ReferenceAlreadyDeclared,
    ClosedContainer,
    AliasAlreadyDeclared,
    AliasStillOpen,
    ContainerNotFound,
    AlreadyDefined,
    ExpressionBuild,
    ExpressionEvaluation,
    Sequence,
    ExpressionItem,
    Syntax,
    Statement,
    Proto,
}
module.exports = Exceptions;
