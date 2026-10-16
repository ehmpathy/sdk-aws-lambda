import { asHeadersWithoutKey } from './asHeadersWithoutKey';

const TEST_CASES: Array<{
  description: string;
  given: { headers: Record<string, unknown> | null | undefined; key: string };
  expect: Record<string, unknown>;
}> = [
  {
    description: 'drops the key in its lowercase form',
    given: {
      headers: { 'x-trail-exid': 'a', accept: 'x' },
      key: 'x-trail-exid',
    },
    expect: { accept: 'x' },
  },
  {
    description: 'drops every case variant of the key',
    given: {
      headers: { 'X-Trail-Exid': 'a', 'x-TRAIL-exid': 'b', accept: 'x' },
      key: 'x-trail-exid',
    },
    expect: { accept: 'x' },
  },
  {
    description: 'keeps a header that only contains the key',
    given: { headers: { 'x-trail-exid-v2': 'a' }, key: 'x-trail-exid' },
    expect: { 'x-trail-exid-v2': 'a' },
  },
  {
    description: 'keeps every other header untouched',
    given: { headers: { Accept: 'a', Host: 'h' }, key: 'x-trail-exid' },
    expect: { Accept: 'a', Host: 'h' },
  },
  {
    description: 'reads a null bag as empty',
    given: { headers: null, key: 'x-trail-exid' },
    expect: {},
  },
  {
    description: 'reads an undefined bag as empty',
    given: { headers: undefined, key: 'x-trail-exid' },
    expect: {},
  },
  {
    description: 'drops a multi-value entry the same way',
    given: {
      headers: { 'X-Trail-Exid': ['a'], Accept: ['x'] },
      key: 'x-trail-exid',
    },
    expect: { Accept: ['x'] },
  },
];

describe('asHeadersWithoutKey', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(asHeadersWithoutKey(thisCase.given)).toEqual(thisCase.expect);
    }),
  );
});
