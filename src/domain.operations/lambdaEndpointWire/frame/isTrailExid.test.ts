import { isTrailExid, TRAIL_EXID_LENGTH_MAX } from './isTrailExid';

const TEST_CASES = [
  {
    description: 'the form the sdk mints',
    value: `exid:${'0'.repeat(36)}`,
    expect: true,
  },
  { description: 'a short id', value: 'a', expect: true },
  { description: 'a printable id with a space', value: 'req 7', expect: true },
  {
    description: 'the longest allowed id',
    value: 'a'.repeat(TRAIL_EXID_LENGTH_MAX),
    expect: true,
  },
  {
    description: 'an id one past the bound',
    value: 'a'.repeat(TRAIL_EXID_LENGTH_MAX + 1),
    expect: false,
  },
  { description: 'a page of text', value: 'a'.repeat(5014), expect: false },
  { description: 'the empty string', value: '', expect: false },
  {
    description: 'an id with a newline',
    value: 'exid:a\nforged log line',
    expect: false,
  },
  {
    description: 'an id with a carriage return',
    value: 'exid:a\rb',
    expect: false,
  },
  { description: 'an id with a tab', value: 'exid:a\tb', expect: false },
  {
    description: 'an id with a null byte',
    value: 'exid:a\u0000b',
    expect: false,
  },
  {
    description: 'an id with a delete character',
    value: 'exid:a\u007fb',
    expect: false,
  },
  {
    description: 'an id with a non-ascii character',
    value: 'exid:é',
    expect: false,
  },
  {
    description:
      'an id that starts with a space: http trims it, so the ends differ',
    value: ' exid:a',
    expect: false,
  },
  {
    description: 'an id that ends with a space',
    value: 'exid:a ',
    expect: false,
  },
  { description: 'only spaces', value: '   ', expect: false },
  { description: 'a number', value: 7, expect: false },
  { description: 'null', value: null, expect: false },
  { description: 'undefined', value: undefined, expect: false },
];

describe('isTrailExid', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(isTrailExid.assess(thisCase.value)).toEqual(thisCase.expect);
    }),
  );
});
