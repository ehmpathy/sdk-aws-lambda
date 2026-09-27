import { given, then, useThen, when } from 'test-fns';

import { asSqsEvent } from '../../../__test_assets__/asSqsEvent';
import { asSqsEventDecoded } from './asSqsEventDecoded';

describe('asSqsEventDecoded', () => {
  given('[case1] a batch of two json messages, each with attributes', () => {
    const event = asSqsEvent({
      messages: [
        { body: '{"to":"a@b.co"}', headers: { OrderId: 'ord-1' } },
        { body: '{"to":"c@d.co"}', headers: { OrderId: 'ord-2' } },
      ],
    });

    when('[t0] decoded', () => {
      const decoded = useThen('it decodes', () =>
        asSqsEventDecoded({ wire: event }),
      );

      then('every record is carried, in order', () => {
        expect(decoded.records.map((record) => record.id)).toEqual([
          'msg-0',
          'msg-1',
        ]);
      });

      then('each body is parsed into its payload', () => {
        expect(decoded.records.map((record) => record.payload)).toEqual([
          { to: 'a@b.co' },
          { to: 'c@d.co' },
        ]);
      });

      then('each attribute bag is flattened, keys verbatim', () => {
        expect(decoded.records.map((record) => record.headers)).toEqual([
          { OrderId: 'ord-1' },
          { OrderId: 'ord-2' },
        ]);
      });

      /**
       * .what = the escape hatch holds the vendor shapes, untouched
       * .why = `receiptHandle`, `md5OfBody`, and the typed `messageAttributes` bag are
       *        reachable only here — a reader who needs one knows they left the paved path
       */
      then('the ejection route holds the wire values', () => {
        expect(decoded._.raw).toBe(event);
        expect(decoded.records[0]!._.raw.receiptHandle).toEqual('receipt-0');
        expect(decoded.records[0]!._.raw.body).toEqual('{"to":"a@b.co"}');
      });
    });
  });

  given('[case2] a message whose body is not json', () => {
    when('[t0] decoded', () => {
      const decoded = asSqsEventDecoded({
        wire: asSqsEvent({ messages: [{ body: 'plain text, not json' }] }),
      });

      /**
       * .what = a non-json body is carried as the string rather than refused
       * .why = a plain-text or csv producer is a legitimate sender, and its own schema is
       *        where that shape gets judged
       */
      then('the payload is the string', () => {
        expect(decoded.records[0]!.payload).toEqual('plain text, not json');
      });
    });
  });

  given('[case3] a message with an empty body', () => {
    when('[t0] decoded', () => {
      const decoded = asSqsEventDecoded({
        wire: asSqsEvent({ messages: [{ body: '' }] }),
      });

      then('the payload reads as null', () => {
        expect(decoded.records[0]!.payload).toEqual(null);
      });
    });
  });

  given('[case4] `deserialize.payload` turned off', () => {
    when('[t0] decoded', () => {
      const decoded = asSqsEventDecoded(
        { wire: asSqsEvent({ messages: [{ body: '{"to":"a@b.co"}' }] }) },
        { deserialize: { payload: false } },
      );

      /**
       * .what = the opt-out is a VALUE, on the page
       * .why = a caller who must verify a signature over the exact bytes reads the string
       *        (`rule.require.explicit-optout`)
       */
      then('the payload is the raw string', () => {
        expect(decoded.records[0]!.payload).toEqual('{"to":"a@b.co"}');
      });
    });
  });

  given('[case5] an empty batch', () => {
    when('[t0] decoded', () => {
      const decoded = asSqsEventDecoded({ wire: asSqsEvent({ messages: [] }) });

      then('it decodes to no records rather than throws', () => {
        expect(decoded.records).toEqual([]);
      });
    });
  });

  given('[case6] a wire value that is not an sqs event', () => {
    when('[t0] decoded', () => {
      /**
       * .what = the fail-loud clamp
       * .why = to hand a handler a half-decoded envelope would make every downstream read a
       *        guess. an s3 record has no `body`, so `payload` would silently be `null`
       *        (`rule.require.failfast`)
       */
      then('it throws rather than decodes', () => {
        expect(() =>
          asSqsEventDecoded({
            wire: { Records: [{ eventSource: 'aws:s3' }] } as never,
          }),
        ).toThrow('wire is not an sqs event shape');
      });
    });
  });
});
