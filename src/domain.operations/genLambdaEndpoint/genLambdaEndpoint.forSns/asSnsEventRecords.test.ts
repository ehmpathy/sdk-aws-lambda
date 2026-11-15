import type { SNSEvent } from 'aws-lambda';
import { getError, given, then, useThen, when } from 'test-fns';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { asSnsEventRecords } from './asSnsEventRecords';

/**
 * .what = an sns event whose one message carries the given attributes
 * .why = the fixture factory sets an empty attribute bag, so a headers case spreads one in
 */
const asSnsEventWithAttributes = (input: {
  message: string;
  attributes: Record<string, string>;
}): SNSEvent => {
  const event = asLambdaEvent.fromSns({ messages: [input.message] });
  const record = event.Records[0]!;
  return {
    Records: [
      {
        ...record,
        Sns: {
          ...record.Sns,
          MessageAttributes: Object.fromEntries(
            Object.entries(input.attributes).map(([name, value]) => [
              name,
              { Type: 'String', Value: value },
            ]),
          ),
        },
      },
    ],
  };
};

describe('asSnsEventRecords', () => {
  given('[case1] a json message with attributes', () => {
    const event = asSnsEventWithAttributes({
      message: '{"notice":"n-1"}',
      attributes: { Origin: 'invoices' },
    });

    when('[t0] decoded', () => {
      const decoded = useThen('it decodes', () =>
        asSnsEventRecords({ wire: event }),
      );

      then('the record id is the MessageId sns issued', () => {
        expect(decoded.records.map((record) => record.id)).toEqual([
          event.Records[0]!.Sns.MessageId,
        ]);
      });

      then('the message is parsed into its payload', () => {
        expect(decoded.records[0]!.payload).toEqual({ notice: 'n-1' });
      });

      then('the attribute bag is flattened, keys verbatim', () => {
        expect(decoded.records[0]!.headers).toEqual({ Origin: 'invoices' });
      });

      /**
       * .what = the escape hatch holds the vendor shapes, untouched
       * .why = `TopicArn`, `Signature`, and the typed attribute bag are reachable only here
       */
      then('the ejection route holds the wire values', () => {
        expect(decoded._.raw).toBe(event);
        expect(decoded.records[0]!._.raw.Sns.Message).toEqual(
          '{"notice":"n-1"}',
        );
      });
    });
  });

  given('[case2] a message that is not json', () => {
    when('[t0] decoded', () => {
      const decoded = asSnsEventRecords({
        wire: asLambdaEvent.fromSns({ messages: ['plain text, not json'] }),
      });

      then('the payload is the string', () => {
        expect(decoded.records[0]!.payload).toEqual('plain text, not json');
      });
    });
  });

  given('[case3] `deserialize.payload` turned off', () => {
    when('[t0] decoded', () => {
      const decoded = asSnsEventRecords(
        { wire: asLambdaEvent.fromSns({ messages: ['{"notice":"n-1"}'] }) },
        { deserialize: { payload: false } },
      );

      then('the payload is the raw string', () => {
        expect(decoded.records[0]!.payload).toEqual('{"notice":"n-1"}');
      });
    });
  });

  given('[case4] a message with no attributes', () => {
    when('[t0] decoded', () => {
      const decoded = asSnsEventRecords({
        wire: asLambdaEvent.fromSns({ messages: ['{}'] }),
      });

      then('the headers bag is empty, never absent', () => {
        expect(decoded.records[0]!.headers).toEqual({});
      });
    });
  });

  given('[case5] a wire value that is not an sns event', () => {
    when('[t0] decoded', () => {
      /**
       * .what = the fail-loud clamp
       * .why = an sqs record has no `Sns` key, so a decode would read `undefined` at every slot
       *        (`rule.require.failfast`)
       */
      then('it throws rather than decodes, and names the fix', async () => {
        const error = await getError(() =>
          asSnsEventRecords({
            wire: asLambdaEvent.fromSqs({ messages: ['{}'] }) as never,
          }),
        );
        expect(error.message).toContain('wire is not an sns event shape');
        expect(error.message).toContain('subscribed to an sns topic');

        // the whole text a developer meets, with the fixture's minted uuids masked
        expect(
          error.message.replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>'),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case6] an sns-stamped record that lacks its `Sns` bag', () => {
    when('[t0] decoded', () => {
      /**
       * .what = the clamp on the guard's bag check
       * .why = the stamp alone passed the guard, so the decode read `wire.Sns.MessageId` and died
       *        on an unnamed TypeError. the bag check routes it to the named refusal
       */
      then('it throws the named refusal, never a TypeError', async () => {
        const error = await getError(() =>
          asSnsEventRecords({
            wire: { Records: [{ EventSource: 'aws:sns' }] } as never,
          }),
        );
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error.message).toContain('wire is not an sns event shape');
        expect(error.message).toMatchSnapshot();
      });
    });
  });
});
