const Generic = require('./exceptions/generic.js');
const CannotBeCastToType = require('./exceptions/cannot_be_cast_to_type.js');
const ReferenceNotFound = require('./exceptions/reference_not_found.js');
const ReferenceNotVisible = require('./exceptions/reference_not_visible.js');
const Internal = require('./exceptions/internal.js');
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

const Exceptions = {
    General,
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
}
module.exports = Exceptions;
