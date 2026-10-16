import { getOneCorrelationIdFromBody } from './getOneCorrelationIdFromBody';

const TEST_CASES = [
  {
    description: 'reads the id from a redacted 500 body',
    given: { body: { errorMessage: 'x', correlationId: 'exid:abc' } },
    expect: { id: 'exid:abc' },
  },
  {
    description: 'reads null when the body holds no id',
    given: { body: { errorMessage: 'x' } },
    expect: { id: null },
  },
  {
    description: 'reads null when the id is not a string',
    given: { body: { correlationId: 7 } },
    expect: { id: null },
  },
  {
    description: 'reads null from null',
    given: { body: null },
    expect: { id: null },
  },
  {
    description: 'reads null from a string',
    given: { body: 'text' },
    expect: { id: null },
  },
  {
    description: 'reads null from undefined',
    given: { body: undefined },
    expect: { id: null },
  },
];

describe('getOneCorrelationIdFromBody', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getOneCorrelationIdFromBody(thisCase.given)).toEqual(
        thisCase.expect.id,
      );
    }),
  );
});
