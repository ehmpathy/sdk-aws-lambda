import { asHttpRequestBody } from './asHttpRequestBody';

const TEST_CASES = [
  {
    description: 'an absent body sends no bytes and no content type',
    given: { body: undefined },
    expect: { text: undefined, contentType: null },
  },
  {
    description: 'a string crosses as is, under no declared content type',
    given: { body: 'plain text' },
    expect: { text: 'plain text', contentType: null },
  },
  {
    description: 'an object is json, and says so',
    given: { body: { to: 'kai@example.com' } },
    expect: {
      text: '{"to":"kai@example.com"}',
      contentType: 'application/json',
    },
  },
  {
    description: 'null is json: the four characters, declared as json',
    given: { body: null },
    expect: { text: 'null', contentType: 'application/json' },
  },
  {
    description: 'an array is json',
    given: { body: [1, 2] },
    expect: { text: '[1,2]', contentType: 'application/json' },
  },
];

describe('asHttpRequestBody', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHttpRequestBody(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
