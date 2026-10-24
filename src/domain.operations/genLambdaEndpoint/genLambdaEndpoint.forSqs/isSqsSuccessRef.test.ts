import { isSqsSuccessRef } from './isSqsSuccessRef';

// only an object with a string `id` names a message sqs can delete
const TEST_CASES: {
  description: string;
  given: { value: unknown };
  expect: { output: boolean };
}[] = [
  {
    description: 'accepts an object with a string id',
    given: { value: { id: 'a' } },
    expect: { output: true },
  },
  {
    description: 'accepts a record, which carries more than its id',
    given: { value: { id: 'a', payload: {} } },
    expect: { output: true },
  },
  {
    description: 'refuses a bare id string',
    given: { value: 'a' },
    expect: { output: false },
  },
  {
    description: 'refuses a null',
    given: { value: null },
    expect: { output: false },
  },
  {
    description: 'refuses an object with no id',
    given: { value: {} },
    expect: { output: false },
  },
  {
    description: 'refuses an object whose id is not a string',
    given: { value: { id: 7 } },
    expect: { output: false },
  },
];

describe('isSqsSuccessRef', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isSqsSuccessRef(thisCase.given.value)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
