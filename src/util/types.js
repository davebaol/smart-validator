const isPlainObject = require('is-plain-object');
const isRegExp = require('is-regexp');
const { BAD_PATH, ensureArrayPath } = require('./path');
const V = require('..');
const {
  REF, isRef, resolveValueRef, resolveValidatorRef, checkUniqueKey
} = require('./ensure-arg');

// Primitive and union types are progressively added below
const NATIVE_TYPES = {};

function addNativeTypes(types) {
  const len = Object.keys(NATIVE_TYPES).length;
  return types.reduce((acc, t, i) => {
    acc[t.name] = t;
    if (t.score === undefined) {
      // Add index-based score
      t.score = len + i; // eslint-disable-line no-param-reassign
    }
    return acc;
  }, NATIVE_TYPES);
}

// -------------------------------------------------------
// -------------------- TYPE CLASSES ---------------------
// -------------------------------------------------------

class Type {
  constructor(name, score) {
    this.name = name;
    this.score = score;
  }

  // Called from inside a getter to create on the this instance
  // a property with the same name that shadows the getter itself
  lazyProperty(key, value, writable, configurable) {
    Object.defineProperty(this, key, { value, writable, configurable });
    return value;
  }

  get nullable() {
    return this.lazyProperty('nullable', this.check(null));
  }

  // Only validators are executable
  get acceptsValidator() { /* eslint-disable no-underscore-dangle */
    const value = this.check(isRef); // Let's test a randomly picked function
    return this.lazyProperty('acceptsValidator', value);
  }

  get swallowsRef() {
    const value = this.check({ $var: ':)' }); // Let's test an object
    return this.lazyProperty('swallowsRef', value);
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) { // eslint-disable-line no-unused-vars
    return true;
  }

  ensure(val, noReference) {
    if (this.check(val)) {
      return val;
    }
    if (!noReference && isRef(val)) {
      return REF;
    }
    throw new Error(`Expected type '${this.name}'`);
  }

  ensureRef(ref, context, obj) {
    return this.ensure(resolveValueRef(ref, context, obj), true);
  }
}

class UnionType extends Type {
  constructor(name, members, score) {
    super(name, score);
    const named = typeof name === 'string' && (typeof members === 'string' || Array.isArray(members));
    const m = named ? members : name;
    const s = named ? score : members;
    this.members = UnionType.parse(m);
    if (!named) {
      this.name = UnionType.membersToString(this.members);
      this.score = s;
    }
  }

  static membersToString(members) {
    return members.map(m => m.name).join('|');
  }

  static parse(members) {
    let m = members;
    if (typeof members === 'string') {
      m = members.split('|');
    } else if (!Array.isArray(members)) {
      throw new Error(`Expected either a '|' separated string or an array of native types; found ${members}`);
    }
    let nullable = false;
    for (let i = 0; i < m.length; i += 1) {
      const tn = m[i];
      const qmIndex = tn.lastIndexOf('?');
      if (qmIndex >= 0) {
        if (m === members) { // clone input array before changing any item
          m = Array.from(m);
        }
        m[i] = tn.substring(0, qmIndex);
        nullable = true;
      }
    }
    if (nullable) {
      m.push('null');
    }
    let out = m.map((typeName) => {
      const tn = typeName.trim();
      const t = NATIVE_TYPES[tn];
      if (t) {
        return t;
      }
      throw new Error(`Unknown native type '${tn}'`);
    });

    // TODO here we should check for ambiguous things like string|path
    // since string is also part of path and has a special treatment, see path.ensure()

    out = out.sort((a, b) => a.score - b.score)
      .filter((x, i, a) => !i || x !== a[i - 1]); // unique

    if (out.length === 0) {
      throw new Error('A union type must have at least one member');
    }
    return out;
  }

  get nullable() {
    const value = this.members.find(m => m.nullable);
    return this.lazyProperty('nullable', value);
  }

  /*
  * Any type accepting an object (for instance any, options, object)
  * considers an unknown ref like a good value, so cannot fail on validator creation
  */
  get swallowsRef() { /* eslint-disable no-underscore-dangle */
    const value = this.members.find(m => m.swallowsRef);
    return this.lazyProperty('swallowsRef', value);
  }

  check(val) {
    for (let i = 0; i < this.members.length; i += 1) {
      if (this.members[i].check(val)) {
        return true;
      }
    }
    return false;
  }

  ensure(val, noReference) {
    if (!noReference && isRef(val)) {
      return REF;
    }
    for (let i = 0; i < this.members.length; i += 1) {
      if (this.members[i].check(val)) {
        // Found member type accepting the value; let's use it for ensuring
        return this.members[i].ensure(val, noReference);
      }
    }
    throw new Error(`Expected type '${this.name}'`);
  }

  ensureRef(ref, context, obj) {
    return this.ensure(resolveValueRef(ref, context, obj), true);
  }
}

// -------------------------------------------------------
// ------------------- PRIMITIVE TYPES -------------------
// -------------------------------------------------------

class NullType extends Type {
  constructor() {
    super('null');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return val == null; // undefined is considered as null
  }
}

class StringType extends Type {
  constructor() {
    super('string');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return typeof val === 'string';
  }
}

class BooleanType extends Type {
  constructor() {
    super('boolean');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return typeof val === 'boolean';
  }
}

class NumberType extends Type {
  constructor() {
    super('number');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return typeof val === 'number';
  }
}

class IntegerType extends Type {
  constructor() {
    super('integer');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return Number.isInteger(val);
  }
}

class ArrayType extends Type {
  constructor() {
    super('array');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return Array.isArray(val);
  }
}

class ObjectType extends Type {
  constructor() {
    super('object');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return isPlainObject(val);
  }

  // Contrary to options, an object can only be referenced as a whole.
  // Its properties cannot be referenced individually.
  ensure(val, noReference) {
    if (!noReference && isRef(val)) {
      return REF;
    }
    if (this.check(val)) {
      return val;
    }
    throw new Error(`Expected type '${this.name}'`);
  }
}

class RegexType extends Type {
  constructor() {
    super('regex');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return isRegExp(val);
  }
}

class ChildType extends Type {
  constructor() {
    super('child');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    if (typeof val === 'function') {
      return true;
    }
    if (isPlainObject(val)) {
      const method = checkUniqueKey(val);
      return method && V[method];
    }
    return false;
  }

  /* eslint-disable-next-line class-methods-use-this */
  ensure(val, noReference) {
    if (typeof val === 'function') {
      return val;
    }
    if (isPlainObject(val)) {
      const method = checkUniqueKey(val);
      if (!method) {
        throw new Error('Error: A plain object validator must have exactly one property where the key is its name and the value is the array of its arguments');
      }
      if (!noReference && isRef(val)) {
        return REF;
      }
      const validate = V[method];
      if (!validate) {
        throw new Error(`Error: Unknown validator '${method}'`);
      }
      return validate(...val[method]);
    }
    throw new Error(`Expected a validator as either a function or a plain object; found a ${typeof val} instead`);
  }

  ensureRef(ref, context) {
    return this.ensure(resolveValidatorRef(ref, context), true);
  }
}

// Add primitive Types
const primitiveTypes = [
  new NullType(),
  new StringType(),
  new IntegerType(),
  new NumberType(),
  new BooleanType(),
  new ArrayType(),
  new ObjectType(),
  new ChildType(),
  new RegexType()
];
addNativeTypes(primitiveTypes);

// -------------------------------------------------------
// --------------------- UNION TYPES ---------------------
// -------------------------------------------------------

const hasOwn = Object.prototype.hasOwnProperty;

class PathType extends UnionType {
  constructor() {
    super('path', 'string|number|array?');
  }

  // Optimized check
  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return val == null || typeof val === 'string' || Array.isArray(val) || typeof val === 'number';
  }

  /* eslint-disable-next-line class-methods-use-this */
  ensure(val, noReference) {
    const p = ensureArrayPath(val);
    if (p === BAD_PATH) {
      if (!noReference && isRef(val)) {
        return REF;
      }
      throw new Error('XXX: the path must be a string, a number, an array of the two previous types, or null');
    }
    return p;
  }
}

const ANY_CHECK_OBJ = ['boolean', 'number', 'object', 'string'].reduce((acc, k) => {
  acc[k] = true;
  return acc;
}, {});

class AnyType extends UnionType {
  constructor() {
    super('any', UnionType.membersToString(primitiveTypes));
  }

  // Optimized check
  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return ANY_CHECK_OBJ[typeof val];
  }

  ensure(val, noReference) {
    if (this.check(val)) {
      return !noReference && isRef(val) ? REF : val;
    }
    throw new Error(`Expected type '${this.name}'`);
  }
}

const ANY_TYPE = new AnyType();

class OptionsType extends Type {
  constructor() {
    super('options');
  }

  /* eslint-disable-next-line class-methods-use-this */
  check(val) {
    return isPlainObject(val);
  }

  // Like object, options can be referenced as a whole.
  // However first level properties can be referenced individually.
  /* eslint-disable-next-line class-methods-use-this */
  ensure(val, noReference) {
    if (val != null) {
      if (!noReference && isRef(val)) {
        return REF;
      }
      if (typeof val !== 'object') {
        throw new Error('optional argument \'options\' must be an object (if specified)');
      }
      // eslint-disable-next-line no-restricted-syntax
      for (const k in val) { // Check if any of the 1st level keys is a reference
        if (hasOwn.call(val, k)) {
          if (isRef(val[k])) { return REF; }
        }
      }
    }
    return val || {};
  }

  ensureRef(ref, context, obj) {
    console.log('*******************************');
    if (isRef(ref)) {
      console.log('Options.ensureRef -> isRef');
      return this.ensure(resolveValueRef(ref, context, obj), true);
    }
    // There must be at least one 1st level key that's a reference to resolve
    let opts = ref;
    console.log('Options.ensureRef -> !isRef ->', ref);
    // eslint-disable-next-line no-restricted-syntax
    for (const k in ref) {
      if (hasOwn.call(ref, k)) {
        console.log('before ANY_TYPE.ensure', ref[k]);
        const opt = ANY_TYPE.ensure(ref[k]);
        console.log('after  ANY_TYPE.ensure', ref[k]);
        if (opt === REF) {
          if (opts === ref) {
            // Lazy shallow copy of the original object is made only when we know
            // for sure that at least one property has to be replaced for some reason.
            // From here on we can safely update items into the copied object, which
            // of course is the one that will be returned.
            opts = Object.assign({}, ref);
          }
          opts[k] = ANY_TYPE.ensureRef(ref[k], context, obj);
        }
      }
    }
    if (opts === ref) {
      console.log('---------------Options.ensureRef');
      // No 1st level key is a reference
      throw new Error('Expected value reference');
    }
    return opts;
  }
}

// Add union types
addNativeTypes([new PathType(), ANY_TYPE, new OptionsType()]);

// Freeze native types
Object.freeze(NATIVE_TYPES);

module.exports = {
  Type,
  UnionType,
  NATIVE_TYPES,
  getNativeType: name => NATIVE_TYPES[name],
  getType: name => (name in NATIVE_TYPES ? NATIVE_TYPES[name] : new UnionType(name))
};
