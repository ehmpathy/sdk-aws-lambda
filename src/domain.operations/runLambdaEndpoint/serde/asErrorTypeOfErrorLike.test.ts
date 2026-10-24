import { ConstraintError } from 'helpful-errors';

import { asErrorTypeOfErrorLike } from './asErrorTypeOfErrorLike';

/**
 * .what = an Error with its stack removed
 * .why = `stack` is optional on an Error, and the runtime's `stack.replaceAll` throws without it
 */
const asErrorStackless = (message: string): Error => {
  const error = new Error(message);
  delete error.stack;
  return error;
};

// one row per branch of the runtime's `toRapidResponse`, `catch` included
const TEST_CASES: {
  description: string;
  given: { error: unknown };
  expect: { output: string };
}[] = [
  {
    description:
      'labels a helpful-errors ConstraintError by its inherited name',
    given: { error: new ConstraintError('order withdrawn') },
    expect: { output: 'Error' },
  },
  {
    description: 'labels an error whose name was set by its own name',
    given: {
      error: Object.assign(new Error('order withdrawn'), {
        name: 'ConstraintError',
      }),
    },
    expect: { output: 'ConstraintError' },
  },
  {
    description:
      'labels a native error with an empty message by its name — `isNativeError` needs no message',
    given: { error: new Error('') },
    expect: { output: 'Error' },
  },
  {
    description: 'labels a native error with no stack as handled',
    given: { error: asErrorStackless('order withdrawn') },
    expect: { output: 'handled' },
  },
  {
    description: 'escapes a DEL in a name, as the runtime does',
    given: {
      error: Object.assign(new Error('x'), { name: 'Bad\x7FName' }),
    },
    expect: { output: 'Bad%7FName' },
  },
  {
    description: 'labels a name + message bag with no stack as an object',
    given: { error: { name: 'ConstraintError', message: 'order withdrawn' } },
    expect: { output: 'object' },
  },
  {
    description: 'labels a full-trio bag by its name',
    given: {
      error: { name: 'ConstraintError', message: 'withdrawn', stack: 'at x' },
    },
    expect: { output: 'ConstraintError' },
  },
  {
    description:
      'labels a trio bag with an empty message as an object — `_isError` reads truthiness',
    given: { error: { name: 'X', message: '', stack: 'at x' } },
    expect: { output: 'object' },
  },
  {
    description: 'labels a bag whose name is not a string as an object',
    given: { error: { name: 42, message: 'order withdrawn', stack: 'at x' } },
    expect: { output: 'object' },
  },
  {
    description:
      'labels an anonymous function with a message and stack as a function — its empty name fails `_isError`',
    given: {
      error: Object.assign(() => null, {
        message: 'order withdrawn',
        stack: 'at x',
      }),
    },
    expect: { output: 'function' },
  },
  {
    description:
      'labels a named function that carries the trio by its name — `_isError` asks no typeof',
    given: {
      error: Object.assign(function quotaFault() {}, {
        message: 'order withdrawn',
        stack: 'at x',
      }),
    },
    expect: { output: 'quotaFault' },
  },
  {
    description: 'labels a thrown string as a string',
    given: { error: 'order withdrawn' },
    expect: { output: 'string' },
  },
  {
    description: 'labels a thrown null as handled — `null.toString()` throws',
    given: { error: null },
    expect: { output: 'handled' },
  },
  {
    description: 'labels a thrown undefined as handled',
    given: { error: undefined },
    expect: { output: 'handled' },
  },
  {
    description: 'labels a null-prototype object as handled — no toString',
    given: { error: Object.create(null) },
    expect: { output: 'handled' },
  },
  {
    description:
      'labels an object whose toString throws as handled — the runtime calls it',
    given: {
      error: {
        toString: () => {
          throw new Error('nope');
        },
      },
    },
    expect: { output: 'handled' },
  },
  {
    description:
      'labels an object whose toString getter throws as handled — the read itself throws',
    given: {
      error: Object.defineProperty({}, 'toString', {
        get: () => {
          throw new Error('nope');
        },
      }),
    },
    expect: { output: 'handled' },
  },
];

describe('asErrorTypeOfErrorLike', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asErrorTypeOfErrorLike(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
