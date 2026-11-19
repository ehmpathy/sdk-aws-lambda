import { asRecordIds } from './asRecordIds';

// the claimable set, read off the validated records
const TEST_CASES: {
  description: string;
  given: { records: { id: string }[] };
  expect: { output: string[] };
}[] = [
  {
    description: 'holds each id of the records',
    given: { records: [{ id: 'a' }, { id: 'b' }] },
    expect: { output: ['a', 'b'] },
  },
  {
    description: 'holds an id once, though carried twice',
    given: { records: [{ id: 'a' }, { id: 'a' }] },
    expect: { output: ['a'] },
  },
  {
    description: 'is empty for no records',
    given: { records: [] },
    expect: { output: [] },
  },
];

describe('asRecordIds', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect([...asRecordIds(thisCase.given)]).toEqual(thisCase.expect.output);
    }),
  );
});
