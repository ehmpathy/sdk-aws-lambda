import { asHttpRequestHeaders } from './asHttpRequestHeaders';

const TEST_CASES: Array<{
  description: string;
  given: Parameters<typeof asHttpRequestHeaders>[0];
  expect: Record<string, string>;
}> = [
  {
    description: 'a json body adds its content type beside the trail key',
    given: {
      contentType: 'application/json',
      headers: undefined,
      trail: { exid: 'exid:a' },
    },
    expect: { 'content-type': 'application/json', 'x-trail-exid': 'exid:a' },
  },
  {
    description: 'no body adds no content type',
    given: { contentType: null, headers: undefined, trail: { exid: 'exid:a' } },
    expect: { 'x-trail-exid': 'exid:a' },
  },
  {
    description: 'a caller content type wins over the one the body implies',
    given: {
      contentType: 'application/json',
      headers: { 'content-type': 'application/vnd.api+json' },
      trail: { exid: 'exid:a' },
    },
    expect: {
      'content-type': 'application/vnd.api+json',
      'x-trail-exid': 'exid:a',
    },
  },
  {
    description:
      'a caller content type of another case still wins, and is the only one',
    given: {
      contentType: 'application/json',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      trail: { exid: 'exid:a' },
    },
    expect: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-trail-exid': 'exid:a',
    },
  },
  {
    description: 'a caller header of the trail key is dropped, in any case',
    given: {
      contentType: null,
      headers: {
        'X-Trail-Exid': 'exid:imposter',
        'x-trail-exid': 'exid:other',
      },
      trail: { exid: 'exid:a' },
    },
    expect: { 'x-trail-exid': 'exid:a' },
  },
  {
    description: 'every other caller header is kept',
    given: {
      contentType: null,
      headers: { Authorization: 'Bearer t' },
      trail: { exid: 'exid:a' },
    },
    expect: { Authorization: 'Bearer t', 'x-trail-exid': 'exid:a' },
  },
];

describe('asHttpRequestHeaders', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHttpRequestHeaders(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
