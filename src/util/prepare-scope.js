const { getNativeType } = require('./types');
const Reference = require('./reference');

const hasOwn = Object.prototype.hasOwnProperty;

const any = getNativeType('any');
const child = getNativeType('child');

function variable(val, ctx, obj) {
  const v = any.ensure(val);
  return v instanceof Reference ? any.ensureRef(val, ctx, obj) : v;
}

function prepareScope(objScope, ctx, obj) {
  // eslint-disable-next-line no-restricted-syntax
  for (const k in objScope) {
    if (hasOwn.call(objScope, k)) {
      // eslint-disable-next-line no-param-reassign
      objScope[k] = k.startsWith('$') ? child.ensure(objScope[k]) : variable(objScope[k], ctx, obj);
    }
  }
  return objScope;
}

module.exports = prepareScope;
