import { isEventWithHeaders } from './isEventWithHeaders';

const TEST_CASES = [
  {
    description: 'a v1 event with both bags',
    value: { headers: {}, multiValueHeaders: {} },
    expect: true,
  },
  {
    description: 'a v2 event with headers only',
    value: { headers: { a: 'b' } },
    expect: true,
  },
  {
    description: 'an event with no bag at all',
    value: { path: '/' },
    expect: true,
  },
  {
    description: 'an event with null bags',
    value: { headers: null, multiValueHeaders: null },
    expect: true,
  },
  { description: 'a string', value: 'event', expect: false },
  { description: 'null', value: null, expect: false },
  { description: 'undefined', value: undefined, expect: false },
  { description: 'a number', value: 7, expect: false },
  {
    description: 'an event whose headers is a string',
    value: { headers: 'x' },
    expect: false,
  },
  {
    description: 'an event whose multiValueHeaders is a number',
    value: { multiValueHeaders: 3 },
    expect: false,
  },
];

describe('isEventWithHeaders', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isEventWithHeaders.assess(thisCase.value)).toEqual(
        thisCase.expect,
      );
    }),
  );

  test('assure throws a helpful error for a value that is not a headers holder', () => {
    expect(() => isEventWithHeaders.assure('event')).toThrow();
  });

  test('assure returns the same value for a headers holder', () => {
    const event = { headers: { a: 'b' } };
    expect(isEventWithHeaders.assure(event)).toBe(event);
  });
});
