import { asHeadersRecord } from './asHeadersRecord';

describe('asHeadersRecord', () => {
  test('casts every header into a plain record, keys lowercased', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Trail-Exid': 'exid:abc',
    });
    expect(asHeadersRecord({ headers })).toEqual({
      'content-type': 'application/json',
      'x-trail-exid': 'exid:abc',
    });
  });

  test('casts an empty bag into an empty record', () => {
    expect(asHeadersRecord({ headers: new Headers() })).toEqual({});
  });
});
