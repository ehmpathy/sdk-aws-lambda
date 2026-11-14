import { BadRequestError, ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import type { LambdaEventSchemaSource } from '../../../../domain.objects/LambdaEventSchemaSource';
import { asLambdaEvent } from '../../../asLambdaEvent/asLambdaEvent';
import { logLambdaEventRefused } from './logLambdaEventRefused';

/**
 * .what = a warn that records each call, injected through context
 * .why = the refusal line is the one durable trace of a dropped event, so its exact shape is the
 *        operator's contract; a fake keeps the read pure and deterministic
 * .note = deliberate mutation in a `const` box — the calls land from inside the operation
 */
const genLogFake = (): {
  context: { log: { warn: (message: string, metadata?: unknown) => void } };
  calls: { message: string; metadata: unknown }[];
} => {
  const calls: { message: string; metadata: unknown }[] = [];
  return {
    calls,
    context: {
      log: {
        warn: (message, metadata) => {
          calls.push({ message, metadata });
        },
      },
    },
  };
};

const sourceOfSns: LambdaEventSchemaSource = { name: 'sns' };
const sourceOfKinesis: LambdaEventSchemaSource = { name: 'kinesis' };

const event = asLambdaEvent.fromSns({ messages: ['{"kind":"alert"}'] });
const messageId = event.Records[0]!.Sns.MessageId;

describe('logLambdaEventRefused', () => {
  given(
    '[case1] a schema refusal, whose metadata holds issue summaries',
    () => {
      when('[t0] the refusal is logged', () => {
        const { context, calls } = genLogFake();
        const issues = [
          { path: 'Records.0.Sns.Message.kind', message: 'expected "notice"' },
        ];
        logLambdaEventRefused(
          {
            event,
            error: new ConstraintError('input invalid', { issues }),
            source: sourceOfSns,
          },
          context,
        );

        then(
          'one warn line names the source, the ids, the class, the cause, the issues, and the fate',
          () => {
            expect(calls).toEqual([
              {
                message: 'lambda.event.refused',
                metadata: {
                  source: 'sns',
                  ids: [messageId],
                  idsCount: 1,
                  idLast: null,
                  class: 'ConstraintError',
                  errorMessage: expect.stringContaining('input invalid'),
                  issues,
                  issuesCount: 1,
                  consequence:
                    'acknowledged; lambda does not retry a success, so this line is the only trace',
                },
              },
            ]);

            // pin the line an operator reads; the id is a fresh uuid per run, so it is masked
            const masked = calls.map((call) => ({
              ...call,
              // .as = `calls` is asserted above to hold an object metadata
              metadata: { ...(call.metadata as object), ids: ['<id>'] },
            }));
            expect(masked[0]?.metadata).toMatchObject({ ids: ['<id>'] });
            expect(masked).toMatchSnapshot();
          },
        );
      });
    },
  );

  given('[case2] a refusal whose metadata holds no issues', () => {
    when('[t0] the error carries no metadata', () => {
      const { context, calls } = genLogFake();
      logLambdaEventRefused(
        {
          event,
          error: new BadRequestError('complaints route to the abuse desk'),
          source: sourceOfSns,
        },
        context,
      );
      then('issues is an empty list, and the class is the one thrown', () => {
        expect(calls[0]?.metadata).toMatchObject({
          class: 'BadRequestError',
          issues: [],
        });
      });
    });

    when('[t1] the metadata holds issues of another shape', () => {
      const { context, calls } = genLogFake();
      logLambdaEventRefused(
        {
          event,
          error: new ConstraintError('refused', { issues: 'not a list' }),
          source: sourceOfSns,
        },
        context,
      );
      then('issues is an empty list, never the foreign value', () => {
        expect(calls[0]?.metadata).toMatchObject({ issues: [] });
      });
    });
  });

  given('[case3] an event that is not sns-shaped (a misroute)', () => {
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      logLambdaEventRefused(
        {
          event: asLambdaEvent.fromSqs({ messages: ['{}'] }),
          error: new ConstraintError('input invalid'),
          source: sourceOfSns,
        },
        context,
      );
      then('the line is still written, with no ids', () => {
        expect(calls).toHaveLength(1);
        expect(calls[0]?.metadata).toMatchObject({ source: 'sns', ids: [] });
      });
    });
  });

  given('[case4] a kinesis batch', () => {
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      const batch = asLambdaEvent.fromKinesis({ records: ['a', 'b'] });
      logLambdaEventRefused(
        {
          event: batch,
          error: new ConstraintError('input invalid'),
          source: sourceOfKinesis,
        },
        context,
      );
      then(
        'the line names every eventID in the batch, and the batch fate',
        () => {
          expect(calls[0]?.metadata).toMatchObject({
            source: 'kinesis',
            ids: batch.Records.map((record) => record.eventID),
            consequence:
              'the whole batch is answered as a success, so lambda does not retry it; this line is the only trace',
          });
        },
      );
    });
  });

  given('[case5] a kinesis batch of 10,000 records, each with an issue', () => {
    // .why = aws's largest kinesis batch; uncapped, its line runs to megabytes, past cloudwatch's
    //        256 KB event limit, and lands split on the one refusal it exists to trace
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      const batch = asLambdaEvent.fromKinesis({
        records: Array.from({ length: 10_000 }, () => 'not json'),
      });
      const issues = batch.Records.map((_, index) => ({
        path: `Records.${index}.kinesis.data`,
        message:
          'not json; to accept text, set deserialize: { payload: false }',
      }));
      const message = `✋ ConstraintError: validation failed: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}\n\n${JSON.stringify({ issues }, null, 2)}`;
      logLambdaEventRefused(
        {
          event: batch,
          error: new ConstraintError(message, { issues }),
          source: sourceOfKinesis,
        },
        context,
      );
      then('each list is capped, with its full count beside it', () => {
        expect(calls[0]?.metadata).toMatchObject({
          ids: batch.Records.slice(0, 100).map((record) => record.eventID),
          idsCount: 10_000,
          idLast: batch.Records[9_999]!.eventID,
          issuesCount: 10_000,
        });
        expect(calls[0]?.metadata).toHaveProperty('issues.length', 20);
      });
      then('the error message keeps one bounded line', () => {
        const { errorMessage } = calls[0]?.metadata as { errorMessage: string };
        expect(errorMessage).not.toContain('\n');
        expect(errorMessage.length).toBeLessThanOrEqual(501);
      });
      then('the whole line stays far under 256 KB', () => {
        expect(JSON.stringify(calls[0]).length).toBeLessThan(32_000);
      });
    });
  });
});
