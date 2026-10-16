import { asCorsHeadersWithTrail } from './asCorsHeadersWithTrail';

const TEST_CASES = [
  {
    description: 'appends the trail header to the sdk default list',
    given: { headers: 'content-type,authorization' },
    expect: { headers: 'content-type,authorization,x-trail-exid' },
  },
  {
    description: 'appends the trail header to an author-set list',
    given: { headers: 'content-type,x-api-key' },
    expect: { headers: 'content-type,x-api-key,x-trail-exid' },
  },
  {
    description: 'does not repeat a header the list already names',
    given: { headers: 'content-type,x-trail-exid' },
    expect: { headers: 'content-type,x-trail-exid' },
  },
  {
    description:
      'reads the listed header case-insensitively and keeps the author text',
    given: { headers: 'Content-Type, X-Trail-Exid' },
    expect: { headers: 'Content-Type, X-Trail-Exid' },
  },
  {
    description: 'an empty list becomes the key alone, with no stray comma',
    given: { headers: '' },
    expect: { headers: 'x-trail-exid' },
  },
  {
    description: 'a list that ends in a comma gains the key with one comma',
    given: { headers: 'content-type,' },
    expect: { headers: 'content-type,x-trail-exid' },
  },
  {
    description: 'does not match a header that only contains the key',
    given: { headers: 'content-type,x-trail-exid-v2' },
    expect: { headers: 'content-type,x-trail-exid-v2,x-trail-exid' },
  },
];

describe('asCorsHeadersWithTrail', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asCorsHeadersWithTrail(thisCase.given)).toEqual(
        thisCase.expect.headers,
      );
    }),
  );
});
