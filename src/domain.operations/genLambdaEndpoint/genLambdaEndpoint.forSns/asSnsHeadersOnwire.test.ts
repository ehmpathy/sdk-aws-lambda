import { given, then, when } from 'test-fns';

import { asSnsHeadersOnwire } from './asSnsHeadersOnwire';

describe('asSnsHeadersOnwire', () => {
  given('[case1] a String attribute', () => {
    when('[t0] flattened', () => {
      const headers = asSnsHeadersOnwire({
        messageAttributes: { orderId: { Type: 'String', Value: 'ord-1' } },
      });

      then('the value sits directly under its name', () => {
        expect(headers).toEqual({ orderId: 'ord-1' });
      });
    });
  });

  given('[case2] a Binary attribute', () => {
    when('[t0] flattened', () => {
      const headers = asSnsHeadersOnwire({
        messageAttributes: { signature: { Type: 'Binary', Value: 'c2ln' } },
      });

      /**
       * .what = sns carries every value at `Value`, whatever its `Type`
       * .why = the base64 string is handed over undecoded, as at sqs, so the two families agree
       */
      then('the base64 value survives, undecoded', () => {
        expect(headers).toEqual({ signature: 'c2ln' });
      });
    });
  });

  given('[case3] two attributes whose names differ only in case', () => {
    when('[t0] flattened', () => {
      const headers = asSnsHeadersOnwire({
        messageAttributes: {
          OrderId: { Type: 'String', Value: 'upper' },
          orderId: { Type: 'String', Value: 'lower' },
        },
      });

      /**
       * .what = the clamp that the api-gateway case-fold does NOT travel here
       * .why = sns attribute names are case-sensitive; a fold would merge these two and drop one
       */
      then('both survive, each under its own case', () => {
        expect(headers).toEqual({ OrderId: 'upper', orderId: 'lower' });
      });
    });
  });

  given('[case4] an absent attribute bag', () => {
    when('[t0] flattened', () => {
      const headers = asSnsHeadersOnwire({ messageAttributes: null });

      then('an empty bag is returned rather than a throw', () => {
        expect(headers).toEqual({});
      });
    });
  });
});
