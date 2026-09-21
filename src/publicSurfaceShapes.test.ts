import { getError, given, then, when } from 'test-fns';

import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP } from './domain.objects/LambdaEndpointErrorResponseBody';
import {
  asLambdaEndpointErrorEnvelopeAncient,
  asLambdaEndpointErrorEnvelopeContemp,
  asLambdaEndpointOutput,
  asLambdaEvent,
  runLambdaEndpoint,
} from './index';

/**
 * .what = snapshots the SHAPE of every new public surface reachable WITHOUT a
 *         remote boundary — the five `asLambdaEvent.from*` factories, and
 *         `onReferenced`'s three outcomes on both dialects.
 *         `onSerialized` reads a `serverless.yml`, so its snapshots live in
 *         `runLambdaEndpoint.onSerialized.integration.test.ts` `[case8][t8]`
 * .why = every sibling operation this package ships carries a `__snapshots__/*.snap`
 *        — `askLambdaEndpoint`, `genLambdaEndpoint`'s two forms,
 *        `getErrorResponseBody`, both middlewares, `getParsedResponse` — and the
 *        rule demands it: `rule.require.snapshots`,
 *        `rule.require.test-coverage-by-grain` (*"sdk method → acceptance test +
 *        snapshots… catches regressions, additions, format changes"*).
 *
 * 🔴 the gap this closes is a REVIEW gap, never a correctness gap. every outcome
 *    already has a `toEqual`; what no `toEqual` gives a reviewer is a DIFF. an
 *    assertion states one field, so a reshape of the envelope shows up as a line
 *    nobody reads, and a reshape of a field nobody asserted shows up not at all.
 *
 * ✅ probed by a change to `resourceId` in `asLambdaEvent.fromApiGateway.ts` —
 *    the snapshot went red and the two explicit assertions in that same test
 *    stayed GREEN. an explicit assertion guards the field its author thought of;
 *    a snapshot guards the ones they did not (`rule.require.snapshots` demands
 *    both, and a lone `toMatchSnapshot` is a failhide).
 *
 * .note = these snapshots are stable BY CONSTRUCTION — every factory pins its
 *   clock and its ids, so no `Date.now()` or `randomUUID()` reaches one. a
 *   snapshot that churns here is a REAL shape change, never a flake.
 */
/**
 * .what = replaces the synthetic per-record uuid with a fixed placeholder
 * .why = `asExampleUuid` keeps real v4 entropy on purpose, so an sqs or sns
 *   snapshot churns on every run and can never go red for a real reason
 *   (`rule.forbid.failhide`). the `beefbeef` marker is kept, so the shape is
 *   still pinned — only the entropy is masked.
 */
const asSnapshottable = <T>(event: T): T =>
  JSON.parse(
    JSON.stringify(event).replace(
      /beefbeef-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g,
      'beefbeef-0000-4000-8000-000000000000',
    ),
  );

describe('public surface shapes', () => {
  /**
   * 🔴 the `[caseN]` labels are VISION-CASE references, never a local counter.
   * `[case11]` is *the fixture manufactures the defect*; `[case2]` is *a
   * constraint error returns an envelope*. a renumber here would invent handles
   * that resolve to no demo.
   */
  given('[case11] the five event factories', () => {
    when('[t0] each casts a payload into its aws envelope', () => {
      then('fromApiGateway carries requestContext and a string body', () => {
        const event = asLambdaEvent.fromApiGateway({
          body: { slug: 'surf-lesson' },
          httpMethod: 'POST',
        });

        // the two fields case=11 is ABOUT: the incumbent omitted both, so a
        // v1-guard deref threw before any schema ran (`sdk-aws-lambda#18`).
        expect(event.requestContext.requestId).toBeDefined();
        expect(typeof event.body).toEqual('string');
        expect(event).toMatchSnapshot();
      });

      then('fromSqs puts the payload at Records[].body', () => {
        const event = asLambdaEvent.fromSqs({
          messages: [JSON.stringify({ kind: 'notify' })],
        });

        expect(JSON.parse(event.Records[0]!.body)).toEqual({ kind: 'notify' });
        expect(asSnapshottable(event)).toMatchSnapshot();
      });

      then('fromSns puts the payload at Records[].Sns.Message', () => {
        const event = asLambdaEvent.fromSns({
          messages: [JSON.stringify({ kind: 'alert' })],
        });

        expect(JSON.parse(event.Records[0]!.Sns.Message)).toEqual({
          kind: 'alert',
        });
        expect(asSnapshottable(event)).toMatchSnapshot();
      });

      then('fromKinesis base64-encodes the payload', () => {
        const event = asLambdaEvent.fromKinesis({
          records: [JSON.stringify({ kind: 'metric' })],
        });

        expect(
          JSON.parse(
            Buffer.from(event.Records[0]!.kinesis.data, 'base64').toString(
              'utf8',
            ),
          ),
        ).toEqual({ kind: 'metric' });
        expect(event).toMatchSnapshot();
      });

      then('fromS3 carries a reference, never a payload', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
        });

        expect(event.Records[0]!.s3.bucket.name).toEqual('photos');
        expect(event).toMatchSnapshot();
      });
    });
  });

  given('[case2] onReferenced, on the contemp dialect', () => {
    const handler = async (payload: {
      event: { serviceUuid: string };
      trail: { exid?: string };
    }) =>
      payload.event.serviceUuid
        ? { found: true, slug: 'surf-lesson' }
        : ({
            error: {
              _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
              class: 'ConstraintError',
              message: 'serviceUuid must be a uuid',
            },
          } as never);

    when('[t0] the handler answers with an output', () => {
      then(
        'the success shape is the handler output, wire-stripped',
        async () => {
          const res = await runLambdaEndpoint.onReferenced({
            event: { serviceUuid: 's1' },
            handler,
          });

          expect(asLambdaEndpointOutput(res).found).toEqual(true);
          expect(res).toMatchSnapshot();
        },
      );
    });

    when('[t1] the handler answers with a constraint envelope', () => {
      then('the envelope is RETURNED, in the contemp shape', async () => {
        const res = await runLambdaEndpoint.onReferenced({
          event: { serviceUuid: '' },
          handler,
        });

        expect(asLambdaEndpointErrorEnvelopeContemp(res).error.class).toEqual(
          'ConstraintError',
        );
        expect(res).toMatchSnapshot();
      });
    });
  });

  given('[case2] onReferenced, on the ancient dialect', () => {
    const handler = async (event: { customerUuid: string }) =>
      event.customerUuid
        ? { delivered: true }
        : ({
            errorMessage: 'customer lacks phone',
            errorType: 'BadRequestError',
          } as never);

    when('[t0] the handler answers with a constraint envelope', () => {
      then('the envelope is RETURNED, in the ancient shape', async () => {
        const res = await runLambdaEndpoint.onReferenced({
          event: { customerUuid: '' },
          handler,
          struct: { payload: 'ancient' },
        });

        // 🔴 the two dialects' envelopes are DIFFERENT SHAPES, and the pair of
        //    snapshots is what makes that legible to a reviewer at a glance.
        //    a `toEqual` states one field; the snapshot states the contract.
        expect(asLambdaEndpointErrorEnvelopeAncient(res).errorType).toEqual(
          'BadRequestError',
        );
        expect(res).toMatchSnapshot();
      });
    });

    when('[t1] the handler answers with a success', () => {
      then('the output is returned bare, in the ancient shape', async () => {
        // 🔴 the positive counterpart to `[t0]`. a dialect's contract is its
        //    success arm AND its envelope arm — pin one alone and half of it is
        //    invisible to a reviewer.
        const res = await runLambdaEndpoint.onReferenced({
          event: { customerUuid: 'uuid-good' },
          handler,
          struct: { payload: 'ancient' },
        });

        expect(res).toEqual({ delivered: true });
        expect(res).toMatchSnapshot();
      });
    });
  });

  /**
   * 🔴 the FRAME is what the handler RECEIVES, and it is the surface with the
   * least assertion coverage relative to how surprising it is: an author who
   * attaches a `trail` for trail coverage silently changes the payload shape
   * their handler sees (`asFramedPayload.ts:51-59`), and — one level on — the
   * error shape it must answer with.
   *
   * ⇒ so the payload itself is snapshotted, per dialect.
   */
  given('[case7] the framed payload the handler receives', () => {
    when('[t0] the dialect selects the frame', () => {
      then('contemp wraps the event, and ancient does not', async () => {
        const seen: unknown[] = [];
        const handler = async (payload: unknown) => {
          seen.push(payload);
          return { ok: true };
        };

        await runLambdaEndpoint.onReferenced({
          event: { uuid: 'a' },
          handler,
          trail: { exid: 'exid:00000000-0000-4000-8000-000000000000' },
        });
        await runLambdaEndpoint.onReferenced({
          event: { uuid: 'a' },
          handler,
          struct: { payload: 'ancient' },
        });

        const [contemp, ancient] = seen;

        // the claim, asserted: one is wrapped, the other is the raw event
        expect(contemp).toHaveProperty('event');
        expect(contemp).toHaveProperty('trail');
        expect(ancient).toEqual({ uuid: 'a' });
        expect({ contemp, ancient }).toMatchSnapshot();
      });
    });
  });

  /**
   * ⚠️ this snapshot locks the error PROSE on purpose. a `toContain` clamp on a
   *    hint that enumerates its own options collides with the fix's own text and
   *    reports a failure that is not one; a snapshot reports a CHANGE, and hands
   *    the reviewer the new copy to accept.
   *
   * .note = so `--resnap` is the correct response to a red HERE, and NOT to a
   *   red on the locus guard's `toContain` clamp.
   */
  given('[case4] the wire strip refuses what json cannot carry', () => {
    when('[t0] the refusal crosses each direction', () => {
      then('the two errors differ in class AND in message', async () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const onEvent = await getError(
          runLambdaEndpoint.onReferenced({
            event: circular,
            handler: async () => ({ ok: true }),
          }),
        );

        const onOutput = await getError(
          runLambdaEndpoint.onReferenced({
            event: { uuid: 'a' },
            handler: async () => {
              const cycle: Record<string, unknown> = {};
              cycle.self = cycle;
              return cycle;
            },
          }),
        );

        // a caller fault and a server fault, and the pair is the contract
        expect(onEvent.constructor.name).toEqual('ConstraintError');
        expect(onOutput.constructor.name).toEqual('MalfunctionError');
        expect({
          onEvent: {
            class: onEvent.constructor.name,
            message: onEvent.message,
          },
          onOutput: {
            class: onOutput.constructor.name,
            message: onOutput.message,
          },
        }).toMatchSnapshot();
      });
    });
  });
});
