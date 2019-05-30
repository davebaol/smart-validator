const clone = require('rfdc')({ proto: false, circles: false });
const { get, set, ensureArrayPath } = require('./path');
const { checkUniqueKey, ANY_VALUE } = require('./misc');

const REF_VALID_KEYS = {
  $path: true,
  $var: true
};

function createRefPath(type, tPath, key, value) {
  const targetPath = ensureArrayPath(tPath);
  if (key === '$path') {
    return { targetPath, path: ensureArrayPath(value) }; // no varName
  }
  // Split value in varName and path
  const index = value.indexOf('.');
  const varName = index < 0 ? value : value.substr(0, index);
  const path = index < 0 ? '' : value.substr(index + 1);
  if (type) {
    const isValidator = varName.startsWith('$');
    if (isValidator) {
      if (!type.acceptsValidator) {
        throw new Error(`Unexpected reference '{"${key}": "${value}"}'. Validator reference non allowed here.`);
      }
      if (path) {
        throw new Error(`Illegal validator reference '{"${key}": "${value}"}'. Deep paths not allowed for a validator reference`);
      }
    } else if (!type.acceptsValue) {
      throw new Error(`Unexpected reference '{"${key}": "${value}"}'. Value reference non allowed here.`);
    }
  }
  return { targetPath, varName, path: ensureArrayPath(path) };
}

function prepareRefPaths(type, o, refPaths, path) {
  if (typeof o !== 'object' || o === null) return refPaths;
  let theRefPaths = refPaths;
  const kRef = Reference.isRef(o); // eslint-disable-line no-use-before-define
  if (kRef) {
    if (theRefPaths === undefined) {
      theRefPaths = [];
    }
    theRefPaths.push(createRefPath(type, path, kRef, o[kRef]));
    return theRefPaths;
  }
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const k in o) {
    const cur = o[k];
    if (typeof cur === 'object' && cur !== null) {
      // Notice that here we pass undefined for the type because it is
      // meaningful only for the root reference, but not for deep references
      theRefPaths = prepareRefPaths(undefined, cur, theRefPaths, path === undefined ? k : `${path}.${k}`);
    }
  }
  return theRefPaths;
}

const VAR_NOT_FOUND = {};

function resolveRefPath(refPath, context, obj) {
  if (refPath.varName === undefined) {
    // Return the value at the referenced path in the input object
    return get(obj, refPath.path);
  }
  // Retrieve the referenced variable/validator
  const isValidator = refPath.varName.startsWith('$');
  const value = context.find(refPath.varName, VAR_NOT_FOUND);
  if (value === VAR_NOT_FOUND) {
    throw new Error(`Unresolved ${isValidator ? 'validator' : 'value'} reference to '${refPath.varName}'`);
  }
  // Return either the validator or the value at the referenced path in the variable
  return isValidator ? value : get(value, refPath.path);
}

class Reference {
  constructor(source, refPathsOrType) {
    this.source = source;
    this.refPaths = Array.isArray(refPathsOrType)
      ? refPathsOrType // Assuming refPathsOrType is an array of refPaths
      : prepareRefPaths(refPathsOrType, source); // Assuming refPathsOrType is a type
    this.isRootRef = this.refPaths.length === 1 && this.refPaths[0].targetPath === undefined;
    // In case of any embedded reference clone the source object into the target,
    // which is where references will be replaced with the actual value
    this.target = this.isRootRef ? undefined : clone(source);
    this.resolved = false;
  }

  static isRef(val) {
    if (typeof val !== 'object' || val === null) {
      return undefined;
    }
    const k = checkUniqueKey(val);
    return REF_VALID_KEYS[k] ? k : undefined;
  }

  static checkReference(type, source) {
    const refPaths = prepareRefPaths(type, source);
    return refPaths == null ? undefined : new Reference(source, refPaths);
  }

  resolve(context, obj) {
    if (this.resolved) {
      return this.target;
    }

    // Set to resolved, then resolve it!
    // Notice that variables in scopes and the object under validation
    // cannot change during validation, so resolving references once for all
    // makes sense
    this.resolved = true;

    // Resolve root reference
    if (this.isRootRef) {
      this.target = resolveRefPath(this.refPaths[0], context, obj);
      return this.target;
    }

    // Resolve embedded references
    const { target, refPaths } = this;
    for (let i = 0, len = refPaths.length; i < len; i += 1) {
      const refPath = refPaths[i];
      const value = resolveRefPath(refPath, context, obj);
      if (!ANY_VALUE[typeof value]) {
        throw new Error(`Expected a value; found ${typeof value} instead.`);
      }
      set(target, refPath.targetPath, value);
    }
    return target;
  }
}

module.exports = Reference;
