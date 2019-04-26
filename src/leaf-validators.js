const v = require('validator');
const isPlainObject = require('is-plain-object');
const lengthOf = require('@davebaol/length-of');
const { get, ensureArrayPath } = require('./util/path');
const { ensureOptions } = require('./util/misc');
const createShortcuts = require('./util/create-shortcuts');

/* eslint-disable no-unused-vars */
const vInfo = {
  contains: args => `containing the value '${args[0]}'`,
  // equals: args => `equal to the value '${args[0]}'`,
  // isAfter: args => `equal to the value '${args[0]}'`,
  isAlpha: args => 'containing only letters (a-zA-Z)',
  isAlphanumeric: args => 'containing only letters and numbers',
  isAscii: args => 'containing ASCII chars only',
  isBase64: args => 'base64 encoded',
  // isBefore: args => `equal to the value '${args[0]}'`,
  // isBoolean: args => `equal to the value '${args[0]}'`,
  isByteLength: args => 'whose length (in UTF-8 bytes) falls in the specified range',
  isCreditCard: args => 'representing a credit card',
  isCurrency: args => 'representing a valid currency amount',
  isDataURI: args => 'in data uri format',
  // isDecimal: args => `equal to the value '${args[0]}'`,
  isDivisibleBy: args => `that's divisible by ${args[0]}`,
  isEmail: args => 'representing an email address',
  // isEmpty: args => `equal to the value '${args[0]}'`,
  isFloat: args => 'that\'s a float falling in the specified range',
  isFQDN: args => 'representing a fully qualified domain name (e.g. domain.com)',
  isFullWidth: args => 'containing any full-width chars',
  isHalfWidth: args => 'containing any half-width chars',
  isHash: args => `matching to the format of the hash algorithm ${args[0]}`,
  // isHexadecimal: args => `equal to the value '${args[0]}'`,
  isHexColor: args => 'matching to a hexadecimal color',
  isIdentityCard: args => 'matching to a valid identity card code',
  // isIn: args => `equal to the value '${args[0]}'`,
  isInt: args => 'that\'s an integer falling in the specified range',
  isIP: args => 'matching to an IP',
  isIPRange: args => 'matching to an IP Range',
  isISBN: args => 'matching to an ISBN',
  isISIN: args => 'matching to an ISIN',
  isISO31661Alpha2: args => 'matching to a valid ISO 3166-1 alpha-2 officially assigned country code',
  isISO31661Alpha3: args => 'matching to a valid ISO 3166-1 alpha-3 officially assigned country code',
  isISO8601: args => 'matching to a valid ISO 8601 date',
  isISRC: args => 'matching to an ISRC',
  isISSN: args => 'matching to an ISSN',
  isJSON: args => 'matching to a valid JSON',
  isJWT: args => 'matching to a valid JWT token',
  isLatLong: args => "representing a valid latitude-longitude coordinate in the format 'lat,long' or 'lat, long'",
  // isLength: args => 'whose length falls in the specified range',
  isLowercase: args => 'in lowercase',
  isMACAddress: args => 'in MAC address format',
  isMagnetURI: args => 'in magnet uri format',
  isMD5: args => 'representing a valid MD5 hash',
  isMimeType: args => 'matching to a valid MIME type format',
  isMobilePhone: args => 'representing a mobile phone number',
  isMongoId: args => 'in the form of a valid hex-encoded representation of a MongoDB ObjectId.',
  isMultibyte: args => 'containing one or more multibyte chars',
  isNumeric: args => 'containing only numbers',
  isPort: args => 'representing a valid port',
  isPostalCode: args => 'representing a postal code',
  isRFC3339: args => 'matching to a valid RFC 3339 date',
  isSurrogatePair: args => 'containing any surrogate pairs chars',
  isUppercase: args => 'in uppercase',
  isURL: args => 'representing a valid URL',
  isUUID: args => 'matching to a UUID (version 3, 4 or 5)',
  isVariableWidth: args => 'containing a mixture of full and half-width chars',
  isWhitelisted: args => 'whose characters belongs to the whitelist',
  matches: args => `matching the regex '${args[0]}'`
};
/* eslint-enable no-unused-vars */

class StringOnly {
  static error(vName, path, vArgs) {
    return `${vName}: the value at path '${path}' must be a string ${vName ? vInfo[vName](vArgs) : ''}`;
  }

  static validator(vName) {
    return (path, ...args) => {
      const p = ensureArrayPath(path);
      return (obj) => {
        const value = get(obj, p);
        if (typeof value !== 'string') {
          return this.error(null, path);
        }
        return v[vName](value, ...args) ? undefined : this.error(vName, path, args);
      };
    };
  }
}

class StringAndNumber {
  static error(vName, path, vArgs) {
    return `${vName}: the value at path '${path}' must be either a string or a number ${vName ? vInfo[vName](vArgs) : ''}`;
  }

  static validator(vName) {
    return (path, ...args) => {
      const p = ensureArrayPath(path);
      return (obj) => {
        let value = get(obj, p);
        const valueType = typeof value;
        if (valueType === 'number') {
          value = String(value);
        } else if (valueType !== 'string') {
          return this.error(null, path);
        }
        return v[vName](value, ...args) ? undefined : this.error(vName, path, args);
      };
    };
  }
}

const primitiveTypeCheckers = {
  boolean: arg => typeof arg === 'boolean',
  null: arg => arg == null, // null or undefined
  number: arg => typeof arg === 'number',
  string: arg => typeof arg === 'string'
};

const typeCheckers = Object.assign(primitiveTypeCheckers, {
  array: arg => Array.isArray(arg),
  object: arg => isPlainObject(arg),
  regex: arg => arg instanceof RegExp
});

const typeCheckerKeys = Object.keys(typeCheckers);
function getType(value) {
  return typeCheckerKeys.find(k => typeCheckers[k](value));
}

//
// LEAF VALIDATORS
// They all take path as the first argument
//
const leafValidators = {
  equals(path, value) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) === value ? undefined : `equals: the value at path '${path}' must be equal to ${value}`);
  },
  isLessThan(path, value) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) < value ? undefined : `isLessThan: the value at path '${path}' must be less than ${value}`);
  },
  isLessThanOrEquals(path, value) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) <= value ? undefined : `isLessThanOrEquals: the value at path '${path}' must be less than or equal to ${value}`);
  },
  isGreaterThan(path, value) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) > value ? undefined : `isGreaterThan: the value at path '${path}' must be greater than ${value}`);
  },
  isGreaterThanOrEquals(path, value) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) >= value ? undefined : `isGreaterThanOrEquals: the value at path '${path}' must be greater than or equal to ${value}`);
  },
  isBetween(path, lower, upper) {
    const p = ensureArrayPath(path);
    return (obj) => {
      const value = get(obj, p);
      return value >= lower && value <= upper ? undefined : `isBetween: the value at path '${path}' must be in the range [${lower}, ${upper}]`;
    };
  },
  isLength(path, options) {
    const p = ensureArrayPath(path);
    const opts = ensureOptions(options, { min: 0, max: undefined });
    return (obj) => {
      const len = lengthOf(get(obj, p));
      if (len === undefined) {
        return `isLength: the value at path '${path}' must be a string, an array or an object`;
      }
      return len >= opts.min && (opts.max === undefined || len <= opts.max) ? undefined : `isLength: the value at path '${path}' must have a length between ${opts.min} and ${opts.max}`;
    };
  },
  isSet(path) {
    const p = ensureArrayPath(path);
    return obj => (get(obj, p) != null ? undefined : `isSet: the value at path '${path}' must be set`);
  },
  isNotEmpty(path) {
    const p = ensureArrayPath(path);
    return (obj) => {
      const value = get(obj, p);
      if (!value) return `the value at path '${path}' must be set`;
      if (typeof value === 'string' && value.trim().length === 0) return `the value at path '${path}' must have at least a not space char`;
      if (typeof value === 'number' && value === 0) return `the value at path '${path}' must not be zero`;
      return undefined;
    };
  },
  isType(path, type) {
    const p = ensureArrayPath(path);
    if (typeof type === 'string' && typeCheckers[type]) {
      return obj => (typeCheckers[type](get(obj, p)) ? undefined : `isType: the value at path '${path}' must be a '${type}'; found '${getType(get(obj, p)) || 'unknown'}' instead`);
    }
    if (Array.isArray(type) && type.every(t => typeof t === 'string' && typeCheckers[t])) {
      return (obj) => {
        const value = get(obj, p);
        return (type.some(t => typeCheckers[t](value)) ? undefined : `isType: the value at path '${path}' must have one of the specified types '${type.join(', ')}'; found '${getType(value) || 'unknown'}' instead`);
      };
    }
    throw new Error(`isType: the type must be a string or an array of strings amongst ${Object.keys(typeCheckers).join(', ')}`);
  },
  isOneOf(path, values) {
    const p = ensureArrayPath(path);
    if (!Array.isArray(values)) {
      throw new Error('isOneOf: argument \'values\' must be an array');
    }
    return obj => (values.includes(get(obj, p)) ? undefined : `isOneOf: the value at path '${path}' must be one of ${values}`);
  },
  isDate(path) {
    const p = ensureArrayPath(path);
    return obj => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(get(obj, p)) ? undefined : `the value at path '${path}' must be a date in this format YYYY-MM-DD HH:MM:SS`);
  },
  isArrayOf(path, type) {
    const p = ensureArrayPath(path);
    if (typeof type === 'string' && typeCheckers[type]) {
      return (obj) => {
        const value = get(obj, p);
        if (!Array.isArray(value)) return `isArrayOf: the value at path '${path}' must be an array; found '${getType(value) || 'unknown'}' instead`;
        const flag = value.every(e => typeCheckers[type](e));
        return flag ? undefined : `isArrayOf: the value at path '${path}' must be a 'array of ${type}'; found '${getType(value) || 'unknown'}' instead`;
      };
    }
    if (Array.isArray(type) && type.every(t => typeof t === 'string' && typeCheckers[t])) {
      return (obj) => {
        const value = get(obj, p);
        if (!Array.isArray(value)) return `isArrayOf: the value at path '${path}' must be a 'array'; found '${getType(value)}' instead`;
        const flag = value.every(e => type.some(t => typeCheckers[t](e)));
        return flag ? undefined : `isArrayOf: the value at path '${path}' must be an array where each item has a type amongst ${Object.keys(type).join(', ')}'; found '${getType(value)}' instead`;
      };
    }
    throw new Error(`isArrayOf: the type must be a string or an array of strings amongst ${Object.keys(typeCheckers).join(', ')}`);
  },
};

//
// Augment leaf validators with the ones from validator module
//
const acceptStringAndNumber = ['isDivisibleBy', 'isFloat', 'isInt', 'isPort'].reduce((acc, k) => {
  acc[k] = true;
  return acc;
}, {});
Object.keys(vInfo).reduce((acc, k) => {
  // 1. Make sure not to overwrite any function already defined locally
  // 2. The value from the validator module must be a function (this prevents errors
  //    due to changes in new versions of the module)
  if (!(k in acc) && typeof v[k] === 'function') {
    acc[k] = (acceptStringAndNumber[k] ? StringAndNumber : StringOnly).validator(k);
  }
  return acc;
}, leafValidators);

//
// Augment all leaf validators with shortcut 'opt'
//
createShortcuts(leafValidators, leafValidators);

module.exports = leafValidators;
