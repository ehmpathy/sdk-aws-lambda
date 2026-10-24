import { getAllSqsSuccessRefsMalformed } from './getAllSqsSuccessRefsMalformed';

// each malformed entry names its position and what it was, for the refusal's metadata
const TEST_CASES: {
  description: string;
  given: { successes: unknown[] };
  expect: { output: { index: number; got: string }[] };
}[] = [
  {
    description: 'finds none when every entry carries a string id',
    given: { successes: [{ id: 'a' }, { id: 'b' }] },
    expect: { output: [] },
  },
  {
    description: 'names a bare id string as a string',
    given: { successes: [{ id: 'a' }, 'b'] },
    expect: { output: [{ index: 1, got: 'string' }] },
  },
  {
    description: 'names a null as null, never as an object',
    given: { successes: [null] },
    expect: { output: [{ index: 0, got: 'null' }] },
  },
  {
    description: 'names an object with no id as an object',
    given: { successes: [{}] },
    expect: { output: [{ index: 0, got: 'object' }] },
  },
  {
    description: 'names an object whose id is not a string as an object',
    given: { successes: [{ id: 7 }] },
    expect: { output: [{ index: 0, got: 'object' }] },
  },
  {
    description: 'names a number as a number',
    given: { successes: [7] },
    expect: { output: [{ index: 0, got: 'number' }] },
  },
];

describe('getAllSqsSuccessRefsMalformed', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getAllSqsSuccessRefsMalformed(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
