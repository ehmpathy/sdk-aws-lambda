import { asHttpMethod } from './asHttpMethod';

const TEST_CASES = [
  {
    description: 'a given method is kept',
    given: { method: 'PUT', body: { a: 1 } },
    expect: 'PUT',
  },
  {
    description: 'a given GET is kept, even with a body',
    given: { method: 'GET', body: 'x' },
    expect: 'GET',
  },
  {
    description: 'no method and a body is a POST',
    given: { method: undefined, body: { a: 1 } },
    expect: 'POST',
  },
  {
    description: 'no method and a string body is a POST',
    given: { method: undefined, body: 'x' },
    expect: 'POST',
  },
  {
    description: 'no method and a null body is a POST: null is a body',
    given: { method: undefined, body: null },
    expect: 'POST',
  },
  {
    description: 'no method and no body is a GET',
    given: { method: undefined, body: undefined },
    expect: 'GET',
  },
];

describe('asHttpMethod', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHttpMethod(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
