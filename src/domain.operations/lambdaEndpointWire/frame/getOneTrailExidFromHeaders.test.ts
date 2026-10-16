import { getOneTrailExidFromHeaders } from './getOneTrailExidFromHeaders';

const TEST_CASES: Array<{
  description: string;
  given: { headers: Record<string, string | undefined> | null | undefined };
  expect: { exid: string | null };
}> = [
  {
    description: 'reads the exid from the one key',
    given: { headers: { 'x-trail-exid': 'exid:abc' } },
    expect: { exid: 'exid:abc' },
  },
  {
    description: 'reads naught when the key is absent',
    given: { headers: { accept: 'application/json' } },
    expect: { exid: null },
  },
  {
    description: 'treats an empty value as absent',
    given: { headers: { 'x-trail-exid': '' } },
    expect: { exid: null },
  },
  {
    description:
      'treats a page of text as absent: an unbounded value is never adopted',
    given: { headers: { 'x-trail-exid': 'a'.repeat(5014) } },
    expect: { exid: null },
  },
  {
    description: 'treats a value past the length bound as absent',
    given: { headers: { 'x-trail-exid': 'a'.repeat(129) } },
    expect: { exid: null },
  },
  {
    description:
      'treats a value with a newline as absent: it cannot forge a log line',
    given: { headers: { 'x-trail-exid': 'exid:a\nforged' } },
    expect: { exid: null },
  },
  {
    description: 'keeps a value at the length bound',
    given: { headers: { 'x-trail-exid': 'a'.repeat(128) } },
    expect: { exid: 'a'.repeat(128) },
  },
  {
    description: 'treats an undefined value as absent',
    given: { headers: { 'x-trail-exid': undefined } },
    expect: { exid: null },
  },
  {
    description: 'reads naught from a null bag',
    given: { headers: null },
    expect: { exid: null },
  },
  {
    description: 'reads naught from an undefined bag',
    given: { headers: undefined },
    expect: { exid: null },
  },
  {
    description: 'never reads x-amzn-trace-id as the exid',
    given: { headers: { 'x-amzn-trace-id': 'Root=1-abc' } },
    expect: { exid: null },
  },
  {
    description: 'never reads traceparent as the exid',
    given: { headers: { traceparent: '00-abc-def-01' } },
    expect: { exid: null },
  },
  {
    description: 'never reads x-request-id or x-correlation-id as the exid',
    given: { headers: { 'x-request-id': 'r1', 'x-correlation-id': 'c1' } },
    expect: { exid: null },
  },
  {
    description:
      'does not read a capitalized key; normalization folds it earlier',
    given: { headers: { 'X-Trail-Exid': 'exid:abc' } },
    expect: { exid: null },
  },
];

describe('getOneTrailExidFromHeaders', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getOneTrailExidFromHeaders(thisCase.given)).toEqual(
        thisCase.expect.exid,
      );
    }),
  );
});
