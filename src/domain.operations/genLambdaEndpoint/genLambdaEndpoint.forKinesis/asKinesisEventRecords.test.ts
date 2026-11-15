import { getError, given, then, useThen, when } from 'test-fns';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { asKinesisEventRecords } from './asKinesisEventRecords';

describe('asKinesisEventRecords', () => {
  given('[case1] a batch of two json records', () => {
    const event = asLambdaEvent.fromKinesis({
      records: ['{"clickId":"c-1"}', '{"clickId":"c-2"}'],
    });

    when('[t0] decoded', () => {
      const decoded = useThen('it decodes', () =>
        asKinesisEventRecords({ wire: event }),
      );

      then('every record is carried, in order, by sequence number', () => {
        expect(decoded.records.map((record) => record.id)).toEqual(
          event.Records.map((record) => record.kinesis.sequenceNumber),
        );
      });

      then(
        'each record is base64-decoded, then parsed into its payload',
        () => {
          expect(decoded.records.map((record) => record.payload)).toEqual([
            { clickId: 'c-1' },
            { clickId: 'c-2' },
          ]);
        },
      );

      /**
       * .what = a kinesis record has no metadata bag, so it has no headers slot at all
       * .why = an empty `{}` would read as "the producer set no attributes", which is not a
       *        fact kinesis can state
       */
      then('no record carries a headers slot', () => {
        expect(decoded.records.map((record) => 'headers' in record)).toEqual([
          false,
          false,
        ]);
      });

      then('the ejection route holds the wire values, still encoded', () => {
        expect(decoded._.raw).toBe(event);
        expect(decoded.records[0]!._.raw.kinesis.data).toEqual(
          event.Records[0]!.kinesis.data,
        );
      });
    });
  });

  given('[case2] a record whose data is not json', () => {
    when('[t0] decoded', () => {
      const decoded = asKinesisEventRecords({
        wire: asLambdaEvent.fromKinesis({ records: ['plain text, not json'] }),
      });

      then('the payload is the decoded text', () => {
        expect(decoded.records[0]!.payload).toEqual('plain text, not json');
      });
    });
  });

  given('[case3] `deserialize.payload` turned off', () => {
    when('[t0] decoded', () => {
      const decoded = asKinesisEventRecords(
        { wire: asLambdaEvent.fromKinesis({ records: ['{"clickId":"c-1"}'] }) },
        { deserialize: { payload: false } },
      );

      /**
       * .what = the opt-out skips the json parse, never the base64 decode
       * .why = kinesis always encodes `data`, so the handler gets utf8 text either way
       */
      then('the payload is the decoded text, unparsed', () => {
        expect(decoded.records[0]!.payload).toEqual('{"clickId":"c-1"}');
      });
    });
  });

  given('[case4] an empty batch', () => {
    when('[t0] decoded', () => {
      const decoded = asKinesisEventRecords({
        wire: asLambdaEvent.fromKinesis({ records: [] }),
      });

      then('it decodes to no records rather than throws', () => {
        expect(decoded.records).toEqual([]);
      });
    });
  });

  given('[case5] a wire value that is not a kinesis event', () => {
    when('[t0] decoded', () => {
      /**
       * .what = the fail-loud clamp
       * .why = an sqs record has no `kinesis` key, so a decode would throw deep inside, or read
       *        `undefined` as data (`rule.require.failfast`)
       */
      then('it throws rather than decodes, and names the fix', async () => {
        const error = await getError(() =>
          asKinesisEventRecords({
            wire: asLambdaEvent.fromSqs({ messages: ['{}'] }) as never,
          }),
        );
        expect(error.message).toContain('wire is not a kinesis event shape');
        expect(error.message).toContain('triggered by a kinesis stream');

        // the whole text a developer meets, with the sqs fixture's minted uuids masked
        expect(
          error.message.replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>'),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case6] a kinesis-stamped record that lacks its `kinesis` bag', () => {
    when('[t0] decoded', () => {
      /**
       * .what = the clamp on the guard's bag check
       * .why = the stamp alone passed the guard, so the decode read `wire.kinesis.data` and died
       *        on an unnamed TypeError. the bag check routes it to the named refusal
       */
      then('it throws the named refusal, never a TypeError', async () => {
        const error = await getError(() =>
          asKinesisEventRecords({
            wire: { Records: [{ eventSource: 'aws:kinesis' }] } as never,
          }),
        );
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error.message).toContain('wire is not a kinesis event shape');
        expect(error.message).toMatchSnapshot();
      });
    });
  });
});
