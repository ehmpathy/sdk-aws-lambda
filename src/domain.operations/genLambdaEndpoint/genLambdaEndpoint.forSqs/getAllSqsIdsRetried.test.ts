import { getAllSqsIdsRetried } from './getAllSqsIdsRetried';

// the retry set: delivered, minus claimed, minus refused, deduped
const TEST_CASES: {
  description: string;
  given: {
    records: { id: string }[];
    successes: { id: string }[];
    idsRefused: Set<string>;
  };
  expect: { output: string[] };
}[] = [
  {
    description: 'retries no record when every record is claimed',
    given: {
      records: [{ id: 'a' }, { id: 'b' }],
      successes: [{ id: 'a' }, { id: 'b' }],
      idsRefused: new Set(),
    },
    expect: { output: [] },
  },
  {
    description: 'retries every record left unclaimed',
    given: {
      records: [{ id: 'a' }, { id: 'b' }],
      successes: [{ id: 'a' }],
      idsRefused: new Set(),
    },
    expect: { output: ['b'] },
  },
  {
    description: 'never retries a refused record, though unclaimed',
    given: {
      records: [{ id: 'a' }, { id: 'b' }],
      successes: [],
      idsRefused: new Set(['b']),
    },
    expect: { output: ['a'] },
  },
  {
    description: 'names an id once, though delivered twice',
    given: {
      records: [{ id: 'a' }, { id: 'a' }],
      successes: [],
      idsRefused: new Set(),
    },
    expect: { output: ['a'] },
  },
  {
    description: 'retries no record of an empty batch',
    given: { records: [], successes: [], idsRefused: new Set() },
    expect: { output: [] },
  },
];

describe('getAllSqsIdsRetried', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getAllSqsIdsRetried(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
