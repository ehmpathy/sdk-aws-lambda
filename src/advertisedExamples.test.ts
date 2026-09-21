import { given, then, when } from 'test-fns';

import type { ContextAwsLambdaCaller } from './index';
import {
  asLambdaEndpointErrorEnvelopeAncient,
  asLambdaEndpointErrorEnvelopeContemp,
  asLambdaEndpointOutput,
  asLambdaEvent,
  isLambdaEndpointErrorEnvelopeContemp,
  runLambdaEndpoint,
} from './index';

/**
 * .what = runs every code sample this repo ADVERTISES — the docblock `@example`
 *         blocks, and the vision catalog's demo samples
 * .why = 🔴 **an advertised sample is a TEST that nobody runs.** it lives in a
 *        comment or a markdown fence, so no compiler reads it and no suite
 *        executes it — and a reader trusts it more than either, because it looks
 *        like the author's own verified code. so a sample that breaks now breaks
 *        a build, rather than a consumer's first try.
 *
 * ⚠️ .the BOUND = this runs the `@example` docblocks and the catalog demos. it
 *   does NOT run the readme's fences, which carry ellipses and free variables and
 *   cannot execute. `advertisedExamples.coverage.integration.test.ts` `[case2]`
 *   checks what CAN be checked there without execution — that every package
 *   symbol the readme advertises is a real export.
 *
 * .note = the case list here is a TOLD guard, so it drifts every time the sample
 *   set grows. `advertisedExamples.coverage.integration.test.ts` is the derived
 *   one: it walks the tree for `@example` and fails when one has no case here.
 *
 * .note = the import is from `./index`, the PUBLIC barrel, on purpose — a sample
 *   that resolves only against a deep relative path is still broken for a
 *   consumer. this clamps the export surface and the examples in one read (F4).
 */
/**
 * .what = the `log` that `onSerialized`'s docblock names but does not construct
 * .why = the sample reads `{ log, env: { access: 'prep' } }`, where `log` is a
 *        FREE variable a consumer supplies. DECLARED rather than built, so the
 *        sample stays verbatim and correctly typed at once — a reader who
 *        reaches for `console` instead hits
 *        `Property '_' is missing in type 'Console'`.
 */
declare const log: ContextAwsLambdaCaller['log'];

describe('docblock examples', () => {
  given('[case1] the asLambdaEvent barrel docblock', () => {
    when('[t0] its two samples are run verbatim', () => {
      then('fromSqs casts a json payload', () => {
        const task = { uuid: 'a' };
        const event = asLambdaEvent.fromSqs({
          messages: [JSON.stringify(task)],
        });
        expect(JSON.parse(event.Records[0]!.body)).toEqual(task);
      });

      then('fromApiGateway casts a body', () => {
        const body = { slug: 'surf-lesson' };
        const event = asLambdaEvent.fromApiGateway({
          body,
          httpMethod: 'POST',
        });
        expect(event.httpMethod).toEqual('POST');
      });
    });
  });

  given('[case2] the fromApiGateway docblock', () => {
    when('[t0] its two samples are run verbatim', () => {
      then('the plain form casts a body and a method', () => {
        const slug = 'surf-lesson';
        const event = asLambdaEvent.fromApiGateway({
          body: { slug },
          httpMethod: 'POST',
        });
        expect(JSON.parse(event.body!)).toEqual({ slug });
      });

      // the nested override needs a deep-partial `requestContext` — see that
      // file's own note
      then('the nested identity override compiles and wins', () => {
        const body = { slug: 'surf-lesson' };
        const event = asLambdaEvent.fromApiGateway({
          body,
          requestContext: { identity: { sourceIp: '10.0.0.1' } },
        });
        expect(event.requestContext.identity.sourceIp).toEqual('10.0.0.1');
      });
    });
  });

  given('[case3] the fromSqs docblock', () => {
    when('[t0] its two samples are run verbatim', () => {
      then('the plain form casts messages', () => {
        const task = { kind: 'notify' };
        const event = asLambdaEvent.fromSqs({
          messages: [JSON.stringify(task)],
        });
        expect(JSON.parse(event.Records[0]!.body)).toEqual(task);
      });

      then('the record override wins over the default', () => {
        const body = JSON.stringify({ kind: 'notify' });
        const event = asLambdaEvent.fromSqs({
          messages: [body],
          record: { eventSourceARN: 'arn:aws:sqs:us-east-1:123:my-queue' },
        });
        expect(event.Records[0]!.eventSourceARN).toEqual(
          'arn:aws:sqs:us-east-1:123:my-queue',
        );
      });
    });
  });

  given('[case4] the fromSns, fromKinesis, and fromS3 docblocks', () => {
    when('[t0] each sample is run verbatim', () => {
      then('fromSns puts the payload at Records[].Sns.Message', () => {
        const notice = { kind: 'alert' };
        const event = asLambdaEvent.fromSns({
          messages: [JSON.stringify(notice)],
        });
        expect(JSON.parse(event.Records[0]!.Sns.Message)).toEqual(notice);
      });

      then('fromKinesis base64-encodes the payload for you', () => {
        const datum = { kind: 'metric' };
        const event = asLambdaEvent.fromKinesis({
          records: [JSON.stringify(datum)],
        });
        const decoded = Buffer.from(
          event.Records[0]!.kinesis.data,
          'base64',
        ).toString('utf8');
        expect(JSON.parse(decoded)).toEqual(datum);
      });

      then('fromS3 carries a reference, never a payload', () => {
        const event = asLambdaEvent.fromS3({
          objects: [{ bucket: 'photos', key: 'a.jpg' }],
        });
        expect(event.Records[0]!.s3.bucket.name).toEqual('photos');
      });
    });
  });

  given('[case5] the onReferenced docblock', () => {
    // 🔴 the dialect frames the INPUT too: a contemp handler receives
    //    `{ event, trail }`, an ancient one the event untouched
    //    (`asFramedPayload.ts:51-59`). a `genLambdaEndpoint` handler never
    //    notices — `genTrailMiddleware` unwraps for it — but a PLAIN handler,
    //    which F7 exists to admit, reads `event.uuid` off the wrapper, finds
    //    `undefined`, and takes its own reject branch on the success case.
    const handlerContemp = async (payload: {
      event: { uuid: string };
      trail: { exid?: string };
    }) =>
      payload.event.uuid
        ? { found: true }
        : ({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: 'the uuid names no known surfer',
            },
          } as never);

    const handlerAncient = async (event: { uuid: string }) =>
      event.uuid
        ? { found: true }
        : ({
            errorMessage: 'the uuid names no known surfer',
            errorType: 'BadRequestError',
          } as never);

    when('[t0] the success sample is run verbatim', () => {
      then('it returns the handler output, wire-stripped', async () => {
        const uuid = 'a';
        const out = await runLambdaEndpoint.onReferenced({
          event: { uuid },
          handler: handlerContemp,
        });
        expect(out).toEqual({ found: true });
      });
    });

    // 🔴 the narrow is NOT optional — the union rejects every error field before
    //    the dialect gets a say, so a bare `res.error.class` fails the type gate
    when('[t1] the contemp-rejection sample is run verbatim', () => {
      then('the narrow makes the nested field readable', async () => {
        const res = await runLambdaEndpoint.onReferenced({
          event: { uuid: '' },
          handler: handlerContemp,
        });
        expect(asLambdaEndpointErrorEnvelopeContemp(res).error.class).toEqual(
          'ConstraintError',
        );
      });
    });

    when('[t2] the ancient-rejection sample is run verbatim', () => {
      then(
        'the dialect is declared on the call AND on the narrow',
        async () => {
          const old = await runLambdaEndpoint.onReferenced({
            event: { uuid: '' },
            handler: handlerAncient,
            struct: { payload: 'ancient' },
          });
          expect(asLambdaEndpointErrorEnvelopeAncient(old).errorType).toEqual(
            'BadRequestError',
          );
        },
      );
    });

    when('[t3] the malfunction sample is run verbatim', () => {
      then('the throw crosses untouched', async () => {
        const brokenHandler = async () => {
          throw new Error('the database is on fire');
        };
        await expect(
          runLambdaEndpoint.onReferenced({
            event: { uuid: 'a' },
            handler: brokenHandler,
          }),
        ).rejects.toThrow('the database is on fire');
      });
    });
  });

  given('[case9] the asLambdaEndpointOutput docblock', () => {
    when('[t0] its sample is run verbatim', () => {
      then('the success narrow reads the stripped field', async () => {
        const event = { when: '2026-09-03T14:00:00.000Z' };
        const handler = async (payload: { event: { when: string } }) => ({
          scheduledAt: new Date(payload.event.when),
        });

        const res = await runLambdaEndpoint.onReferenced({ event, handler });
        expect(asLambdaEndpointOutput(res).scheduledAt).toEqual(
          '2026-09-03T14:00:00.000Z',
        );
      });
    });
  });

  given('[case6] the isLambdaEndpointErrorEnvelopeContemp docblock', () => {
    when('[t0] both its samples are run verbatim', () => {
      then('the boolean half narrows inside an if', () => {
        const res: unknown = {
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'ConstraintError',
            message: 'nope',
          },
        };
        expect(isLambdaEndpointErrorEnvelopeContemp(res)).toEqual(true);
      });

      then('the assure half returns the narrowed envelope', () => {
        const res: unknown = {
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'ConstraintError',
            message: 'the uuid names no known surfer',
          },
        };
        const envelope = asLambdaEndpointErrorEnvelopeContemp(res);
        expect(envelope.error.message).toContain('no known surfer');
      });
    });
  });

  // ⚠️ onSerialized's samples cross a WIRE, so they cannot be RUN here. the
  //    defect this file catches is a TYPE defect, and `tsc` checks a closure
  //    body whether or not the closure is called — so the function is
  //    deliberately never invoked.
  given('[case7] the onSerialized docblock', () => {
    when('[t0] its sample is type-checked without a wire', () => {
      then('the call shape resolves as advertised', () => {
        // 🟡 the return ANNOTATION is what bites: `onSerialized` is declared
        //    `Promise<TOutput>` with no union (a caller fault throws on this
        //    boundary), so the day that changes this line stops to compile.
        //
        //    ✅ probed: widen the prod return to `Promise<TOutput | {…}>` and
        //       `tsc` fails TS2322 — ONLY here, so this is its sole clamp.
        const neverRun = async (): Promise<{ found: boolean }> =>
          runLambdaEndpoint.onSerialized<{ slug: string }, { found: boolean }>(
            {
              which: {
                service: 'svc-home-services',
                function: 'getServiceBySlug',
              },
              event: { slug: 'surf-lesson' },
              at: 'cloud',
            },
            { log, env: { access: 'prep' } },
          );

        // the runtime half claims only that the closure was built; the
        // guarantee belongs to the annotation above
        expect(neverRun).toBeInstanceOf(Function);
      });
    });
  });

  /**
   * .what = the vision catalog's demo samples, run verbatim
   * .why = the catalog is what a reviewer and a migrant read FIRST — before the
   *        readme, before a docblock. so a broken sample there is copied more,
   *        not less, than a broken one in the api docs.
   *
   */
  given('[case8] the vision catalog demos', () => {
    const handlerAncient = async (event: { customerUuid: string }) =>
      event.customerUuid
        ? { delivered: true }
        : ({
            errorMessage: 'customer lacks phone',
            errorType: 'BadRequestError',
          } as never);

    const handlerContemp = async (payload: {
      event: { serviceUuid: string };
      trail: { exid?: string };
    }) =>
      payload.event.serviceUuid
        ? { found: true }
        : ({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: 'serviceUuid must be a uuid',
            },
          } as never);

    when('[t0] case=1 + case=2 — the contemp rejection sample', () => {
      then('the narrow makes the nested field readable', async () => {
        const result = await runLambdaEndpoint.onReferenced({
          event: { serviceUuid: '' },
          handler: handlerContemp,
        });
        expect(
          asLambdaEndpointErrorEnvelopeContemp(result).error.class,
        ).toEqual('ConstraintError');
      });
    });

    // 🔴 `struct` selects WHICH envelope the union's second arm holds; it does
    //    not collapse the union. so the narrow is owed on either dialect, and a
    //    destructure straight off the result is `TS2339`.
    when('[t1] case=7 — nia destructures the ancient envelope', () => {
      then(
        'the destructure binds off the NARROW, and her assertion holds',
        async () => {
          const res = await runLambdaEndpoint.onReferenced({
            event: { customerUuid: '' },
            handler: handlerAncient,
            struct: { payload: 'ancient' },
          });
          const { errorMessage } = asLambdaEndpointErrorEnvelopeAncient(res);
          expect(errorMessage).toContain('phone');
        },
      );

      then(
        'and the ancient dialect hands her handler the RAW event',
        async () => {
          const res = await runLambdaEndpoint.onReferenced({
            event: { customerUuid: 'c1' },
            handler: handlerAncient,
            struct: { payload: 'ancient' },
          });
          expect(res).toEqual({ delivered: true });
        },
      );
    });

    // 🔴 the union refuses a read on EITHER arm, so the SUCCESS case needs a
    //    narrow too — `asLambdaEndpointOutput`. a bare `res.scheduledAt` is
    //    `TS2339`, and that is the majority case.
    when('[t2] case=4 — the outbound strip is asserted per-field', () => {
      const handlerDated = async (payload: { event: { when: string } }) => ({
        scheduledAt: new Date(payload.event.when),
      });

      then('the success narrow makes the field readable', async () => {
        const res = await runLambdaEndpoint.onReferenced({
          event: { when: '2026-09-03T14:00:00.000Z' },
          handler: handlerDated,
        });
        expect(asLambdaEndpointOutput(res).scheduledAt).toEqual(
          '2026-09-03T14:00:00.000Z',
        );
      });

      // the narrow must INFER the output type, or it buys no more than a cast.
      // a TYPE assertion first — the compile is the proof.
      then(
        'and it infers the output type, with no dialect declared',
        async () => {
          const res = await runLambdaEndpoint.onReferenced({
            event: { when: '2026-09-03T14:00:00.000Z' },
            handler: handlerDated,
          });
          // 🔴 the annotation reads `string` where the HANDLER declared `Date` —
          //    `LambdaEndpointRunOutput` carries `WireStripped<TOutput>`, so the
          //    type states what the strip did rather than what the handler wrote
          const out: { scheduledAt: string } = asLambdaEndpointOutput(res);
          expect(out.scheduledAt).toBeDefined();
        },
      );

      // ✅ the strongest clamp here is the line that is ABSENT: under
      //    `WireStripped<TOutput>`, `out.scheduledAt instanceof Date` does not
      //    compile — TS2358, the left side must be an object type. so a
      //    re-introduction of the unsound `TOutput` is caught by `tsc`, never by
      //    a runtime assertion that could drift.
      then('and the type TELLS the truth about the strip', async () => {
        const res = await runLambdaEndpoint.onReferenced({
          event: { when: '2026-09-03T14:00:00.000Z' },
          handler: handlerDated,
        });
        const out = asLambdaEndpointOutput(res);

        // typed `string` by `WireStripped`; valued `string` by the strip
        expect(typeof out.scheduledAt).toEqual('string');
      });

      then(
        'it throws LOUD when the endpoint answered with an envelope',
        async () => {
          const res = await runLambdaEndpoint.onReferenced({
            event: { serviceUuid: '' },
            handler: handlerContemp,
          });
          expect(() => asLambdaEndpointOutput(res)).toThrow('never an output');
        },
      );
    });
  });
});
