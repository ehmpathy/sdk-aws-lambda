import { asRecordBatchResponse } from './asRecordBatchResponse';

// the one place `id` becomes aws's `itemIdentifier`
const TEST_CASES: {
  description: string;
  given: { idsRetried: string[] };
  expect: { output: { batchItemFailures: { itemIdentifier: string }[] } };
}[] = [
  {
    description: 'renders each retried id under the wire name',
    given: { idsRetried: ['a', 'b'] },
    expect: {
      output: {
        batchItemFailures: [{ itemIdentifier: 'a' }, { itemIdentifier: 'b' }],
      },
    },
  },
  {
    description: 'renders an empty list when no id is retried',
    given: { idsRetried: [] },
    expect: { output: { batchItemFailures: [] } },
  },
];

describe('asRecordBatchResponse', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asRecordBatchResponse(thisCase.given)).toEqual(
        thisCase.expect.output,
      );
    }),
  );
});
