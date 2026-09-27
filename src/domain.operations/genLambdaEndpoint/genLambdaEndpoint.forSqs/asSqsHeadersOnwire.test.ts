import { given, then, when } from 'test-fns';

import { asSqsHeadersOnwire } from './asSqsHeadersOnwire';

describe('asSqsHeadersOnwire', () => {
  given('[case1] a String attribute', () => {
    when('[t0] flattened', () => {
      const headers = asSqsHeadersOnwire({
        messageAttributes: {
          orderId: { stringValue: 'ord-1', dataType: 'String' },
        },
      });

      then('the value sits directly under its name', () => {
        expect(headers).toEqual({ orderId: 'ord-1' });
      });
    });
  });

  given('[case2] a Binary attribute', () => {
    when('[t0] flattened', () => {
      const headers = asSqsHeadersOnwire({
        messageAttributes: {
          signature: { binaryValue: 'c2ln', dataType: 'Binary' },
        },
      });

      /**
       * .what = the clamp on the `stringValue ?? binaryValue` arm
       * .why = a `Binary` attribute carries its value at `binaryValue`. read only
       *        `stringValue` and the sender's value reads as ABSENT, with no error anywhere —
       *        which is exactly the silent loss `rule.forbid.failhide` names
       */
      then('the base64 value survives, undecoded', () => {
        expect(headers).toEqual({ signature: 'c2ln' });
      });
    });
  });

  given('[case3] two attributes whose names differ only in case', () => {
    when('[t0] flattened', () => {
      const headers = asSqsHeadersOnwire({
        messageAttributes: {
          OrderId: { stringValue: 'upper', dataType: 'String' },
          orderId: { stringValue: 'lower', dataType: 'String' },
        },
      });

      /**
       * .what = the clamp that the api-gateway case-fold does NOT travel here
       * .why = sqs attribute names are case-SENSITIVE, so these are two distinct attributes a
       *        sender may set together. a fold would merge them and drop one, silently. this
       *        goes red the moment someone sweeps `asHeaderKeysLowercased` across the families
       */
      then('both survive, each under its own case', () => {
        expect(headers).toEqual({ OrderId: 'upper', orderId: 'lower' });
      });
    });
  });

  given('[case4] an attribute with neither value set', () => {
    when('[t0] flattened', () => {
      const headers = asSqsHeadersOnwire({
        messageAttributes: {
          empty: { dataType: 'String' },
        },
      });

      then('the name is present and the value reads as absent', () => {
        expect(Object.keys(headers)).toEqual(['empty']);
        expect(headers.empty).toEqual(undefined);
      });
    });
  });

  given('[case5] an absent attribute bag', () => {
    when('[t0] flattened', () => {
      const headers = asSqsHeadersOnwire({ messageAttributes: undefined });

      then('an empty bag is returned rather than a throw', () => {
        expect(headers).toEqual({});
      });
    });
  });
});
