import { assert } from 'chai';
import V from '../src';

const success = () => undefined;
const failure = () => 'failure';

describe('Test branch validator if.', () => {
  it('if(success, success, failure) should succeed', () => {
    const v = V.if(success, success, failure);
    assert(v({}) === undefined, ':(');
  });
  it('if(failure, success, failure) should fail', () => {
    const v = V.if(failure, success, failure);
    assert(v({}) !== undefined, ':(');
  });
  const notBoth = (condStr, condFunc) => it(`if(${condStr}, then, else) should validate either then or else, never both`, () => {
    let count = 0;
    const inc = () => { count += 1; };
    const v = V.if(condFunc, inc, inc);
    v({});
    assert(count === 1, ':(');
  });
  notBoth('success', success);
  notBoth('failure', failure);
});

describe('Test branch validator alter.', () => {
  it('alter(success, "OK", "KO") should return "OK"', () => {
    const v = V.alter(success, 'OK', 'KO');
    assert(v({}) === 'OK', ':(');
  });
  it('alter(failure, "OK", "KO") should return "KO"', () => {
    const v = V.alter(failure, 'OK', 'KO');
    assert(v({}) === 'KO', ':(');
  });
});

describe('Test branch validator onError.', () => {
  it('onError("error", success) should succeed', () => {
    const v = V.onError('error', success);
    assert(v({}) === undefined, ':(');
  });
  it('onError("error", failure) should fail', () => {
    const v = V.onError('error', failure);
    assert(v({}) === 'error', ':(');
  });
});

describe('Test branch validator not.', () => {
  it('not(failure) should succeed', () => {
    const v = V.not(failure);
    assert(v({}) === undefined, ':(');
  });
  it('not(success) should fail', () => {
    const v = V.not(success);
    assert(v({}) !== undefined, ':(');
  });
});

describe('Test branch validator and.', () => {
  it('and(success, success) should succeed', () => {
    const v = V.and(success, success);
    assert(v({}) === undefined, ':(');
  });
  it('and(failure, success) should fail', () => {
    const v = V.and(failure, success);
    assert(v({}) !== undefined, ':(');
  });
  it('and(failure, failure) should fail', () => {
    const v = V.and(failure, failure);
    assert(v({}) !== undefined, ':(');
  });
  it('and(success, failure) should fail', () => {
    const v = V.and(success, failure);
    assert(v({}) !== undefined, ':(');
  });
});

describe('Test branch validator or.', () => {
  it('or(success, success) should succeed', () => {
    const v = V.or(success, success);
    assert(v({}) === undefined, ':(');
  });
  it('or(failure, success) should succeed', () => {
    const v = V.or(failure, success);
    assert(v({}) === undefined, ':(');
  });
  it('or(failure, failure) should fail', () => {
    const v = V.or(failure, failure);
    assert(v({}) !== undefined, ':(');
  });
  it('or(success, failure) should succeed', () => {
    const v = V.or(success, failure);
    assert(v({}) === undefined, ':(');
  });
});

describe('Test branch validator xor.', () => {
  it('xor(success, success) should fail', () => {
    const v = V.xor(success, success);
    assert(v({}) !== undefined, ':(');
  });
  it('xor(failure, success) should succeed', () => {
    const v = V.xor(failure, success);
    assert(v({}) === undefined, ':(');
  });
  it('xor(failure, failure) should fail', () => {
    const v = V.xor(failure, failure);
    assert(v({}) === undefined, ':(');
  });
  it('xor(success, failure) should succeed', () => {
    const v = V.xor(success, failure);
    assert(v({}) === undefined, ':(');
  });
});
