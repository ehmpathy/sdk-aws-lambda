import { given, then, when } from 'test-fns';

import { getDecodedPayload } from './getDecodedPayload';

describe('getDecodedPayload', () => {
  given('[case1] valid JSON payload', () => {
    when('[t0] payload is Uint8Array of JSON string', () => {
      then('it should return decoded string', () => {
        const json = '{"id":"123","name":"test"}';
        const payload = new TextEncoder().encode(json);
        const result = getDecodedPayload({ payload });
        expect(result).toBe(json);
      });
    });
  });

  given('[case2] plain text payload', () => {
    when('[t0] payload is Uint8Array of plain text', () => {
      then('it should return decoded string', () => {
        const text = 'hello world';
        const payload = new TextEncoder().encode(text);
        const result = getDecodedPayload({ payload });
        expect(result).toBe(text);
      });
    });
  });

  given('[case3] empty payload', () => {
    when('[t0] payload is empty Uint8Array', () => {
      then('it should return empty string', () => {
        const payload = new Uint8Array(0);
        const result = getDecodedPayload({ payload });
        expect(result).toBe('');
      });
    });
  });

  given('[case4] unicode payload', () => {
    when('[t0] payload contains unicode characters', () => {
      then('it should decode correctly', () => {
        const text = '{"emoji":"🐢","name":"seaturtle"}';
        const payload = new TextEncoder().encode(text);
        const result = getDecodedPayload({ payload });
        expect(result).toBe(text);
      });
    });
  });
});
