import { getAllSqsIdsUnclaimable } from './getAllSqsIdsUnclaimable';

// a claim on a record the handler was never handed would delete an unserved message
const TEST_CASES: {
  description: string;
  given: { successes: { id: string }[]; idsClaimable: Set<string> };
  expect: { output: string[] };
}[] = [
  {
    description: 'finds no id when every claim was handed over',
    given: {
      successes: [{ id: 'a' }],
      idsClaimable: new Set(['a', 'b']),
    },
    expect: { output: [] },
  },
  {
    description: 'finds each claim outside the handed set',
    given: {
      successes: [{ id: 'a' }, { id: 'forged' }],
      idsClaimable: new Set(['a']),
    },
    expect: { output: ['forged'] },
  },
  {
    description: 'finds every claim when no record was handed over',
    given: { successes: [{ id: 'a' }], idsClaimable: new Set() },
    expect: { output: ['a'] },
  },
];

describe('getAllSqsIdsUnclaimable', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getAllSqsIdsUnclaimable(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
