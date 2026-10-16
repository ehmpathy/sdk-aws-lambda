import { getOneBodyFromHttpText } from './getOneBodyFromHttpText';

const TEST_CASES = [
  {
    description: 'a json object reads as the object',
    given: { text: '{"sentTo":"kai@example.com"}' },
    expect: { body: { sentTo: 'kai@example.com' } },
  },
  {
    description: 'empty text reads as null: a 204 holds no body',
    given: { text: '' },
    expect: { body: null },
  },
  {
    description: 'html reads as null: a gateway 502 is not json',
    given: { text: '<html>bad gateway</html>' },
    expect: { body: null },
  },
  {
    description: 'a json null reads as null',
    given: { text: 'null' },
    expect: { body: null },
  },
  {
    description: 'a json array reads as the array',
    given: { text: '[1,2]' },
    expect: { body: [1, 2] },
  },
];

describe('getOneBodyFromHttpText', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getOneBodyFromHttpText(thisCase.given)).toEqual(
        thisCase.expect.body,
      );
    }),
  );
});
