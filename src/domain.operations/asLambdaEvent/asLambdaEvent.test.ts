import { MalfunctionError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { forApiGateway } from '../genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import { asLambdaContext } from '../runLambdaEndpoint/context/asLambdaContext';
import { asLambdaEvent } from './asLambdaEvent';

/**
 * .what = replaces the synthetic per-record uuid with a fixed placeholder
 * .why = `asExampleUuid` keeps real v4 entropy on purpose, so a whole-shape
 *   snapshot of an sqs or sns event churns on every run and can never go red for
 *   a real reason (`rule.forbid.failhide`).
 *
 * ⇒ the `beefbeef` marker is KEPT, so the snapshot still pins that the id is
 *   synthetic and v4-shaped — only the entropy is masked, never the shape.
 */
const asSnapshottable = <T>(event: T): T =>
  JSON.parse(
    JSON.stringify(event).replace(
      /beefbeef-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g,
      'beefbeef-0000-4000-8000-000000000000',
    ),
  );

describe('asLambdaEvent', () => {
  given(
    '[case11] an api-gateway endpoint with a zod schema on its body',
    () => {
      const handler = forApiGateway({
        schema: {
          input: z.object({ slug: z.string().min(1) }),
          output: z.object({ slug: z.string(), found: z.boolean() }),
        },
        invoke: async ({ event }) => ({ slug: event.slug, found: true }),
      });

      const run = async (event: unknown) =>
        (await (handler as any)(event, asLambdaContext())) as {
          statusCode: number;
          body: string;
        };

      when('[t0] the event is built with only { body, httpMethod }', () => {
        const result = useThen('it resolves', async () =>
          run(
            asLambdaEvent.fromApiGateway({
              body: { slug: 'surf-lesson' },
              httpMethod: 'POST',
            }),
          ),
        );

        // 🔴 the incumbent omits requestContext, so forApiGateway derefs undefined
        //    and the handler answers 500 before any schema runs.
        then('the schema RUNS — the response is not a 500', () => {
          expect(result.statusCode).not.toEqual(500);
        });

        then('the event carries a requestContext, supplied unasked', () => {
          const event = asLambdaEvent.fromApiGateway({ body: {} });
          expect(event.requestContext).toBeDefined();
          expect(event.requestContext.requestId).toBeDefined();
        });

        then('the event carries Accept, so middy matches a serializer', () => {
          const event = asLambdaEvent.fromApiGateway({ body: {} });
          expect(event.headers.Accept).toEqual('application/json');
        });
      });

      // 🔴 the parity clamp. api gateway sends the multi-value twin of every
      //    header and query param on EVERY request, and the incumbent already
      //    derives both — a hardcoded `{}` would make the successor LESS
      //    wire-faithful than the fixture it replaces.
      when('[t4] a handler reads the multi-value twins', () => {
        then('multiValueHeaders is DERIVED from headers, never empty', () => {
          const event = asLambdaEvent.fromApiGateway({
            body: {},
            headers: { 'X-Trace': 'abc' },
          });
          expect(event.multiValueHeaders['X-Trace']).toEqual(['abc']);
          // the defaults get twins too — a handler that reads Accept multi-value
          // would otherwise see an absent key where the wire sends one
          expect(event.multiValueHeaders.Accept).toEqual(['application/json']);
        });

        then(
          'multiValueQueryStringParameters is DERIVED when params exist',
          () => {
            const event = asLambdaEvent.fromApiGateway({
              body: {},
              queryStringParameters: { spot: 'pipeline' },
            });
            expect(event.multiValueQueryStringParameters).toEqual({
              spot: ['pipeline'],
            });
          },
        );

        then('it stays null when no params exist — as aws sends it', () => {
          // null rather than {} is the faithful shape: aws omits the pair
          // entirely on a request with no query string.
          const event = asLambdaEvent.fromApiGateway({ body: {} });
          expect(event.multiValueQueryStringParameters).toEqual(null);
        });
      });

      /**
       * 🔴 the FOURTH half of the unit clamp — see [E2][t1], [E3], [E4][t1].
       *
       * api gateway sends both `requestTimeEpoch` (a number) and `requestTime`
       * (common log format) on every request, so a factory that sends the epoch
       * alone shows a handler `undefined` in a test and a value in production.
       *
       * ⇒ `requestTime` is DERIVED (`AWS_EVENT_AT_CLF`), and the clamp ties it
       *   to the epoch on the SAME event rather than to a literal — no gate can
       *   catch two valid stamps of different kinds that drifted apart.
       */
      when('[t6] a handler reads the api-gateway timestamps', () => {
        then('both stamps are sent, as aws sends both', () => {
          const event = asLambdaEvent.fromApiGateway({ body: {} });

          expect(event.requestContext.requestTimeEpoch).toBeDefined();
          expect(event.requestContext.requestTime).toBeDefined();
        });

        then('and they name ONE instant — the derivation, clamped', () => {
          const event = asLambdaEvent.fromApiGateway({ body: {} });
          const { requestTime, requestTimeEpoch } = event.requestContext;

          // 🔴 the clamp reads BOTH off the same event and compares them through
          //    a third representation the impl does not share — `Date`'s own utc
          //    accessors. so it cannot pass by agreement with what its author
          //    typed, and it cannot pass by a shared bug in `asClfStamp`.
          //
          //    ⇒ a hand-written CLF literal that drifted from the epoch fails
          //      here, which is the exact defect the sns/s3 ISO copy shipped.
          const at = new Date(requestTimeEpoch);
          const expected = `${String(at.getUTCDate()).padStart(2, '0')}/Sep/${at.getUTCFullYear()}`;

          expect(requestTime).toContain(expected);
          // aws stamps utc, so the offset is fixed — a local-time derivation
          // would drift by the builder's timezone across machines
          expect(requestTime).toContain('+0000');
        });

        then(
          'extendedRequestId is sent — aws stamps it on every request',
          () => {
            const event = asLambdaEvent.fromApiGateway({ body: {} });

            expect(event.requestContext.extendedRequestId).toBeDefined();
          },
        );

        // 🟡 the NEGATIVE half. `connectionId` is a websocket-api field, and this
        //    builder makes a REST/HTTP v1 event — to stamp it would be
        //    wire-infidelity pointed the other way, an envelope aws never sends
        //    for this kind. so its absence is a decision, and this records it.
        then('connectionId is ABSENT — it is a websocket field', () => {
          const event = asLambdaEvent.fromApiGateway({ body: {} });

          expect(event.requestContext.connectionId).toEqual(undefined);
        });
      });

      when('[t5] a test whose SUBJECT is a base64 body', () => {
        then('isBase64Encoded is an override, not a hardcode', () => {
          // the incumbent accepts this parameter, so a migrant who passes it
          // would have hit a compile error on the swap this wish exists to make.
          const event = asLambdaEvent.fromApiGateway({
            body: 'ZGF0YQ==',
            isBase64Encoded: true,
          });
          expect(event.isBase64Encoded).toEqual(true);
        });

        then('it defaults to false, as the common case', () => {
          expect(
            asLambdaEvent.fromApiGateway({ body: {} }).isBase64Encoded,
          ).toEqual(false);
        });
      });

      when('[t1] the handler succeeds', () => {
        const result = useThen('it resolves', async () =>
          run(
            asLambdaEvent.fromApiGateway({
              body: { slug: 'surf-lesson' },
              httpMethod: 'POST',
            }),
          ),
        );

        // 🔴 without Accept, middy hands the body back as an OBJECT where api
        //    gateway requires a string, and every JSON.parse(result.body) fails.
        then('result.body is a STRING, never an object', () => {
          expect(typeof result.body).toEqual('string');
        });

        then('JSON.parse of it yields the handler output', () => {
          expect(JSON.parse(result.body)).toMatchObject({
            slug: 'surf-lesson',
            found: true,
          });
        });
      });

      when('[t2] the body fails the schema', () => {
        const result = useThen('it resolves', async () =>
          run(
            asLambdaEvent.fromApiGateway({
              body: { slug: '' },
              httpMethod: 'POST',
            }),
          ),
        );

        // 🔴 this and [t4] are what prove D6 is not orthogonal to D2: the same
        //    outcome family takes a DIFFERENT shape here, because the source
        //    selected a different endpoint kind.
        //
        // ⚠️ the forApiGateway handler is the VEHICLE, never the deliverable —
        //    out of scope to BUILD, in scope to WALK. see dimensions.md.
        then('the response is a 400, never a throw', () => {
          expect(result.statusCode).toEqual(400);
        });
      });

      when(
        '[t3] the author overrides a metadata field the test is about',
        () => {
          then(
            'the override wins; defaults fill only what was not named',
            () => {
              const event = asLambdaEvent.fromApiGateway({
                body: {},
                requestContext: { requestId: 'my-own-request-id' },
              });
              expect(event.requestContext.requestId).toEqual(
                'my-own-request-id',
              );
              // the un-named fields still arrive, so the guard does not become an
              // immovable fixture
              expect(event.requestContext.stage).toBeDefined();
            },
          );

          then(
            'a NESTED override keeps its peer fields — the docblock advertises this',
            () => {
              // 🔴 the merge is shallow, so a nested override would REPLACE the
              //    whole `identity` object and drop every peer field with it —
              //    the very shape F10 exists to prevent. a fixture that returns a
              //    LESS wire-faithful event the moment an author customizes it
              //    manufactures the defect it guards.
              //
              // 🟡 no `as` cast here, on purpose. a `Partial<RequestContext>` that
              //    leaves `identity` WHOLE demands all ~15 of its fields for a
              //    partial identity, which forbids what the merge already
              //    supports. a test that reaches for `as` to use an api THIS repo
              //    owns reports a defect in that api, never a quirk of the test
              //    (rule.forbid.as-cast).
              const event = asLambdaEvent.fromApiGateway({
                body: {},
                requestContext: { identity: { sourceIp: '10.0.0.1' } },
              });
              expect(event.requestContext.identity.sourceIp).toEqual(
                '10.0.0.1',
              );
              expect(event.requestContext.identity.userAgent).toBeDefined();
            },
          );
        },
      );

      when('[t4] a malfunction is raised inside the handler', () => {
        const brokenHandler = forApiGateway({
          schema: {
            input: z.object({ slug: z.string() }),
            output: z.object({ slug: z.string() }),
          },
          invoke: async () => {
            throw new MalfunctionError('the database is on fire');
          },
        });

        then(
          'the response is a 500 — it RETURNS, where forAskEndpoint throws',
          async () => {
            const result = (await (brokenHandler as any)(
              asLambdaEvent.fromApiGateway({
                body: { slug: 'x' },
                httpMethod: 'POST',
              }),
              asLambdaContext(),
            )) as { statusCode: number };
            expect(result.statusCode).toEqual(500);
          },
        );
      });

      // 🔴 the two NULLISH sentinels must land on ONE wire shape. api gateway
      //    sends `body: null` for a request that carries none, and an explicit
      //    `null` that falls through to `JSON.stringify(null)` yields the
      //    four-character STRING `'null'` — so a handler reads `'null'` in the
      //    test and `null` in production.
      when('[t5] the body is nullish', () => {
        then('an OMITTED body is null, as the wire delivers', () => {
          const event = asLambdaEvent.fromApiGateway({ httpMethod: 'GET' });
          expect(event.body).toEqual(null);
        });

        // 🔴 the teeth. absent the nullish guard this is the string 'null'.
        then('an EXPLICIT null is null too — never the string', () => {
          const event = asLambdaEvent.fromApiGateway({
            body: null as unknown as string,
            httpMethod: 'GET',
          });
          expect(event.body).toEqual(null);
          expect(event.body).not.toEqual('null');
        });

        // the two sentinels agree — the property the pair above rests on
        then('the two nullish sentinels agree', () => {
          const omitted = asLambdaEvent.fromApiGateway({ httpMethod: 'GET' });
          const explicit = asLambdaEvent.fromApiGateway({
            body: null as unknown as string,
            httpMethod: 'GET',
          });
          expect(explicit.body).toEqual(omitted.body);
        });
      });
    },
  );

  given('[E2] the sqs source', () => {
    when('[t0] messages are cast', () => {
      then('the payload lives at Records[].body, as a json string', () => {
        const event = asLambdaEvent.fromSqs({
          messages: [JSON.stringify({ task: 'a' })],
        });
        expect(typeof event.Records[0]!.body).toEqual('string');
        expect(JSON.parse(event.Records[0]!.body)).toEqual({ task: 'a' });
      });

      then('every aws field is defined — no undefined deref waits', () => {
        const record = asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!;
        expect(record.messageId).toBeDefined();
        expect(record.eventSourceARN).toBeDefined();
        expect(record.attributes).toBeDefined();
        expect(record.awsRegion).toBeDefined();
      });
    });

    /**
     * 🔴 the UNIT clamp — half of a pair with [E4][t1] below.
     *
     * `asLambdaEvent.constants.ts` names two constants for one instant, because
     * aws does not agree with itself: sqs stamps epoch MILLIS, kinesis stamps
     * epoch SECONDS. the name carries the unit and no test enforced it.
     *
     * ⇒ so an editor who reads `AWS_EVENT_AT_EPOCH_S` beside its `_MS` twin sees
     *   what looks like a dropped `000` and "repairs" it — and absent this
     *   clamp the suite stays green while the fixture drifts off the wire.
     */
    when('[t1] a handler reads the sqs timestamps', () => {
      then('they are epoch MILLIS, as sqs sends them', () => {
        const record = asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!;

        expect(record.attributes.SentTimestamp).toEqual('1757289600000');
        expect(record.attributes.ApproximateFirstReceiveTimestamp).toEqual(
          '1757289600000',
        );
      });

      then('they are STRINGS — sqs attributes carry no numbers', () => {
        const record = asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!;

        expect(typeof record.attributes.SentTimestamp).toEqual('string');
      });
    });
  });

  given('[E3] the sns source', () => {
    when('[t0] messages are cast', () => {
      then('the payload lives at Records[].Sns.Message', () => {
        const event = asLambdaEvent.fromSns({ messages: ['hello'] });
        expect(event.Records[0]!.Sns.Message).toEqual('hello');
        expect(event.Records[0]!.Sns.TopicArn).toBeDefined();
      });
    });

    /**
     * 🔴 the third half of the unit clamp — see [E2][t1] and [E4][t1].
     *
     * sns stamps an ISO STRING where sqs stamps millis and kinesis stamps
     * seconds. that third representation matches no numeric-literal grep, so it
     * is the one most apt to keep a hand-written copy and drift.
     *
     * ⇒ no gate can catch that alone — both strings are valid ISO stamps, and
     *   each factory's own test asserts only its own value. hence the
     *   cross-source relation below.
     */
    when('[t1] a handler reads the sns timestamp', () => {
      then('it is an ISO string, as sns sends it', () => {
        const record = asLambdaEvent.fromSns({ messages: ['x'] }).Records[0]!;

        expect(record.Sns.Timestamp).toEqual('2025-09-08T00:00:00.000Z');
      });

      then('it names the same instant every other source does', () => {
        // 🟡 the cross-source relation, asserted rather than assumed. this is the
        //    clamp that bites on a FOURTH representation added later, since any
        //    new one must agree with these three or fail here.
        const snsAt = Date.parse(
          asLambdaEvent.fromSns({ messages: ['x'] }).Records[0]!.Sns.Timestamp,
        );
        const sqsAt = Number(
          asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!.attributes
            .SentTimestamp,
        );
        const kinesisAt = asLambdaEvent.fromKinesis({ records: ['x'] })
          .Records[0]!.kinesis.approximateArrivalTimestamp;

        expect(snsAt).toEqual(sqsAt);
        expect(snsAt).toEqual(kinesisAt * 1000);
      });
    });
  });

  given('[E4] the kinesis source', () => {
    when('[t0] records are cast', () => {
      then('the payload is BASE64 at Records[].kinesis.data', () => {
        const event = asLambdaEvent.fromKinesis({ records: ['hello'] });
        const data = event.Records[0]!.kinesis.data;
        expect(Buffer.from(data, 'base64').toString('utf8')).toEqual('hello');
      });
    });

    // 🔴 the other half of the unit clamp — see [E2][t1]. this is the arm that
    //    LOOKS wrong: a bare 1757289600 beside sqs's 1757289600000 reads as a
    //    typo, and it is the correct value. kinesis is the one aws source that
    //    stamps epoch SECONDS.
    when('[t1] a handler reads the kinesis timestamp', () => {
      then('it is epoch SECONDS, never millis', () => {
        const record = asLambdaEvent.fromKinesis({ records: ['x'] })
          .Records[0]!;

        expect(record.kinesis.approximateArrivalTimestamp).toEqual(1757289600);
      });

      then('it is a NUMBER — kinesis carries no string stamp', () => {
        const record = asLambdaEvent.fromKinesis({ records: ['x'] })
          .Records[0]!;

        expect(typeof record.kinesis.approximateArrivalTimestamp).toEqual(
          'number',
        );
      });

      then('it names the same instant the sqs stamp does', () => {
        // 🟡 the relation is the point — the two constants are one moment in two
        //    units, and `_S` is DERIVED from `_MS` so they cannot drift. this
        //    asserts the relation rather than either literal, so it survives a
        //    deliberate change to the instant and bites on a change to the unit.
        const kinesisAt = asLambdaEvent.fromKinesis({ records: ['x'] })
          .Records[0]!.kinesis.approximateArrivalTimestamp;
        const sqsAt = Number(
          asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!.attributes
            .SentTimestamp,
        );

        expect(kinesisAt * 1000).toEqual(sqsAt);
      });
    });
  });

  given('[E5] the s3 source', () => {
    when('[t0] objects are cast', () => {
      then('it carries a REFERENCE — there is no payload', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
        });
        expect(event.Records[0]!.s3.bucket.name).toEqual('photos');
        expect(event.Records[0]!.s3.object.key).toEqual('a.jpg');
        expect(event.Records[0]!.s3).not.toHaveProperty('body');
      });

      // 🔴 the fourth half of the unit clamp. an ISO stamp copied by hand drifts
      //    silently — it matches no numeric grep, and s3's copy can read 2026
      //    where the shared instant reads 2025. so the relation is asserted per
      //    SITE rather than per factory.
      then('eventTime names the shared instant, never its own', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
        });
        const sqsAt = Number(
          asLambdaEvent.fromSqs({ messages: ['x'] }).Records[0]!.attributes
            .SentTimestamp,
        );

        expect(Date.parse(event.Records[0]!.eventTime)).toEqual(sqsAt);
      });
    });

    // 🔴 the parity clamp. aws documents the notification TYPE as
    //    `s3:ObjectCreated:Put` and delivers the event NAME as
    //    `ObjectCreated:Put`. an author who copies the documented string is
    //    right; a pass-through hands back an event no real bucket sends — and
    //    it type-checks, so no gate catches it.
    when('[t1] the author names the event as aws DOCUMENTS it', () => {
      then('the s3: prefix is stripped, as the wire delivers it', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
          eventName: 's3:ObjectCreated:Put',
        });
        expect(event.Records[0]!.eventName).toEqual('ObjectCreated:Put');
      });

      then('the wire form passes through unchanged', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
          eventName: 'ObjectRemoved:Delete',
        });
        expect(event.Records[0]!.eventName).toEqual('ObjectRemoved:Delete');
      });
    });
  });

  given('[E6] the ask source', () => {
    when('[t0] the barrel is inspected', () => {
      then('there is NO fromAsk — the ask source wraps naught', () => {
        // 🔴 an identity factory on an object whose whole purpose is to
        //    construct envelopes would imply an envelope exists where there is
        //    none. the incumbent exports no createExampleAskEvent either.
        expect('fromAsk' in asLambdaEvent).toEqual(false);
      });
    });
  });

  /**
   * .what = one whole-shape snapshot per factory
   * .why = every assertion above is FIELD-BY-FIELD, so each one proves a field is
   *        right and not one proves the SET is. a field silently added, dropped,
   *        or renamed leaves every one of them green.
   *
   * 🔴 a migrant reads and pastes these outputs, so a diff in review is how a
   *    shape change gets seen at all (`rule.require.snapshots`).
   *
   * ⚠️ the risk is not even across the five — `fromApiGateway` emits a 15-field
   *    `identity`, a full `requestContext`, and two DERIVED multi-value twins,
   *    and it is the one source with a shipped defect (`sdk-aws-lambda#18`).
   *
   * 🟡 the INSTANT is pinned (`asLambdaEvent.constants.ts`), and the per-record
   *    uuid is NOT — `asExampleUuid` keeps real v4 entropy so two fixtures in one
   *    store cannot collide. so the entropy is masked below rather than pinned.
   */
  given('[E7] the shape of every factory, pinned', () => {
    when('[t0] each factory is cast with its minimal input', () => {
      then('fromApiGateway emits a stable whole shape', () => {
        expect(
          asLambdaEvent.fromApiGateway({
            body: { slug: 'surf-lesson' },
            httpMethod: 'POST',
          }),
        ).toMatchSnapshot();
      });

      then('fromSqs emits a stable whole shape', () => {
        expect(
          asSnapshottable(
            asLambdaEvent.fromSqs({ messages: [JSON.stringify({ task: 'a' })] }),
          ),
        ).toMatchSnapshot();
      });

      then('fromSns emits a stable whole shape', () => {
        expect(
          asSnapshottable(asLambdaEvent.fromSns({ messages: ['hello'] })),
        ).toMatchSnapshot();
      });

      then('fromKinesis emits a stable whole shape', () => {
        expect(
          asLambdaEvent.fromKinesis({ records: ['hello'] }),
        ).toMatchSnapshot();
      });

      then('fromS3 emits a stable whole shape', () => {
        expect(
          asLambdaEvent.fromS3({
            objects: [{ bucket: 'surf-reports', key: 'pipeline.json' }],
          }),
        ).toMatchSnapshot();
      });
    });
  });
});
