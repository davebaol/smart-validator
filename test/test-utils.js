import { assert } from 'chai';
import Expression from '../src/util/expression';
import Scope from '../src/util/scope';
import { clone } from '../src/util/misc';
import V from '../src';

const UNKNOWN_REF = Object.freeze({ $unknownRefType: 'anything' });

const PRIMITIVE_VALUES = [
  [], // array
  true, // boolean
  V.isSet(''), // child
  null, // null
  1.2, // number
  1, // integer
  {}, // object
  /.*/, // regex
  'Hello' // string
];

class TypeTestInfo {
  constructor(type) {
    this.type = type;
    this.name = this.type.name;
    this.goodValue = PRIMITIVE_VALUES.find(v => this.type.check(v));
    if (this.goodValue === undefined) {
      throw new Error(`Good value not found for type ${this.name}`);
    }
    this.badValue = PRIMITIVE_VALUES.find(v => !this.type.check(v));
    if (this.badValue === undefined) {
      throw new Error(`Bad value not found for type ${this.name}`);
    }
  }

  acceptValueRef() {
    return this.type.acceptsValue;
  }

  acceptValidatorRef() {
    return this.type.acceptsValidator;
  }

  value(good) {
    return good ? this.goodValue : this.badValue;
  }

  /*
  * Any argument accepting an object (for instance any and object) considers an
  * unknown ref like a good value, so won't fail at compile-time (validator creation)
  */
  unknownRefShouldPassCreation() {
    if (this.type.swallowsRef) {
      try {
        return Expression.prepareRefPaths(this.type, UNKNOWN_REF) == null;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}

// Calculate distinct types used by the arguments of all validators
const typeInfo = Object.keys(V).reduce((acc, k) => {
  V[k].info.argDescriptors.forEach((ad) => {
    const typeName = ad.type.name;
    if (!acc[typeName]) {
      acc[typeName] = new TypeTestInfo(ad.type);
      // console.log('type', typeName);
    }
  });
  return acc;
}, {});

function ordinal(n) {
  switch (n) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${n}th`;
  }
}

function testArgument(vld, args, index, errorLike) {
  const argDesc = vld.info.argDescriptors[vld.info.adjustArgDescriptorIndex(index)];
  const kind = argDesc.type.name;
  if (!(kind in typeInfo)) {
    throw new Error(`Unknown type argument '${kind}'`);
  }
  const testArgs = Array.from(args);

  // Test unexpected value
  it(`Should throw immediately an error on bad ${kind} as ${ordinal(index + 1)} argument`, () => {
    testArgs[index] = typeInfo[kind].badValue;
    assert.throws(() => vld(...testArgs), errorLike || Error);
  });

  // Test optional/mandatory argument
  if (argDesc.type.nullable) {
    it(`Should accept null being ${kind} optional as ${ordinal(index + 1)} argument`, () => {
      testArgs[index] = null;
      assert(typeof vld(...testArgs) === 'function', ':(');
    });
  } else {
    it(`Should throw immediately an error on null being ${kind} mandatory as ${ordinal(index + 1)} argument`, () => {
      testArgs[index] = null;
      assert.throws(() => vld(...testArgs), errorLike || Error);
    });
  }

  // Test references
  if (argDesc.refDepth >= 0) {
    if (typeInfo[kind].unknownRefShouldPassCreation()) {
      it(`Should pass creation on unknown reference type as ${ordinal(index + 1)} argument`, () => {
        testArgs[index] = UNKNOWN_REF;
        assert(typeof vld(...testArgs) === 'function', ':(');
      });
    } else {
      it(`Should throw immediately an error on unknown reference type as ${ordinal(index + 1)} argument`, () => {
        testArgs[index] = UNKNOWN_REF;
        assert.throws(() => vld(...testArgs), errorLike || Error);
      });
    }
    it(`Should delay $var reference resolution at validation time for ${kind} as ${ordinal(index + 1)} argument`, () => {
      testArgs[index] = { $var: `${argDesc.type.acceptsValidator ? '$someValidator' : 'some.value'}` };
      assert(typeof vld(...testArgs) === 'function', ':(');
    });
  }
}

const VALIDATION = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'fail',
  THROW: 'throw an error',
  DO_NOT_THROW: 'not throw an error'
});

function testValidationAssert(expectedResult, vCreate, obj) {
  switch (expectedResult) {
    case VALIDATION.SUCCESS:
      assert(vCreate()(new Scope(obj)) === undefined, ':(');
      break;
    case VALIDATION.FAILURE:
      assert(vCreate()(new Scope(obj)) !== undefined, ':(');
      break;
    case VALIDATION.THROW:
      assert.throws(() => vCreate()(new Scope(obj)), Error);
      break;
    case VALIDATION.DO_NOT_THROW:
      assert.doesNotThrow(() => vCreate()(new Scope(obj)), Error);
      break;
    default:
      assert(false, 'Unknown expected result');
      break;
  }
}

function testAllArguments(v, args) {
  const len = Math.max(v.info.argDescriptors.length, args.length);
  for (let i = 0; i < len; i += 1) {
    testArgument(v, args, i);
  }
}

// All arguments are passed without using references
function testValidationWithNoRefs(expected, obj, vld, ...args) {
  it(`${vld.info.name}(${args.map(a => JSON.stringify(a)).join(', ')}) should ${expected} for ${JSON.stringify(obj)}`, () => {
    const vCreate = () => vld(...args);
    testValidationAssert(expected, vCreate, obj);
  });
}

// All referenceable arguments are passed as $var references
// If bad is >= 0 then the arg at that index is passed
// as a reference to a bad value.
function testValidationWithVarRefs0(expected, obj, vld, args, bad = -1) {
  const scope = args.reduce((acc, a, i) => {
    const argDef = vld.info.argDescriptors[vld.info.adjustArgDescriptorIndex(i)];
    if (argDef.refDepth >= 0) {
      const kind = argDef.type.name;
      const value = i !== bad ? a : typeInfo[kind].badValue;
      acc[`${typeInfo[kind].acceptValidatorRef() ? '$' : ''}v${i}`] = value;
    }
    return acc;
  }, {});
  const varArgs = args.map((a, i) => {
    const argDef = vld.info.argDescriptors[vld.info.adjustArgDescriptorIndex(i)];
    const kind = argDef.type.name;
    if (argDef.refDepth >= 0) {
      return { $var: `${typeInfo[kind].acceptValidatorRef() ? '$' : ''}v${i}` };
    }
    return a;
  });
  it(`${vld.info.name}(${varArgs.map(a => JSON.stringify(a)).join(', ')}) in scope ${JSON.stringify(scope)} should ${expected} for ${JSON.stringify(obj)}`, () => {
    const vCreate = () => V.def(scope, vld(...varArgs));
    testValidationAssert(expected, vCreate, obj);
  });
}

function testValidationWithVarRefs(expected, obj, vld, ...args) {
  // All references to good value
  testValidationWithVarRefs0(expected, obj, vld, args);

  // Use reference to a bad value for one argument at a time
  for (let i = 0; i < args.length; i += 1) {
    const argDef = vld.info.argDescriptors[vld.info.adjustArgDescriptorIndex(i)];
    const expected2 = argDef.type.acceptsValidator ? VALIDATION.THROW : VALIDATION.FAILURE;
    testValidationWithVarRefs0(expected2, obj, vld, clone(args), i);
  }
}

function testValidation(expectedResult, obj, vld, ...args) {
  // Accept up to 3 expected results. The array is right padded using the last element
  const expected = [].concat(expectedResult);
  const len = expected.length;
  expected.length = 3;
  expected.fill(expected[len - 1], len);

  // Test no references
  testValidationWithNoRefs(expected[0], obj, vld, ...args);

  // Test $var references
  testValidationWithVarRefs(expected[1], obj, vld, ...args);
}

export {
  typeInfo as argInfo,
  testArgument,
  testAllArguments,
  testValidation,
  VALIDATION
};
