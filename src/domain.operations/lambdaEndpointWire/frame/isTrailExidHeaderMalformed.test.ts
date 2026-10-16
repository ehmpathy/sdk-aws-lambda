import { isTrailExidHeaderMalformed } from './isTrailExidHeaderMalformed';

const TEST_CASES: Array<{
  description: string;
  given: { headers: Record<string, string | undefined> | null | undefined };
  expect: boolean;
}> = [
  {
    description: 'a well-formed exid is not malformed',
    given: { headers: { 'x-trail-exid': 'exid:a' } },
    expect: false,
  },
  {
    description: 'a page of text is malformed',
    given: { headers: { 'x-trail-exid': 'a'.repeat(5014) } },
    expect: true,
  },
  {
    description: 'a value with a newline is malformed',
    given: { headers: { 'x-trail-exid': 'exid:a\nforged' } },
    expect: true,
  },
  {
    description: 'an empty value is absent, not malformed',
    given: { headers: { 'x-trail-exid': '' } },
    expect: false,
  },
  {
    description: 'an absent key is not malformed',
    given: { headers: { accept: 'application/json' } },
    expect: false,
  },
  {
    description: 'an undefined value is not malformed',
    given: { headers: { 'x-trail-exid': undefined } },
    expect: false,
  },
  { description: 'a null bag', given: { headers: null }, expect: false },
  {
    description: 'an undefined bag',
    given: { headers: undefined },
    expect: false,
  },
];

describe('isTrailExidHeaderMalformed', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isTrailExidHeaderMalformed(thisCase.given)).toEqual(
        thisCase.expect,
      );
    }),
  );
});
