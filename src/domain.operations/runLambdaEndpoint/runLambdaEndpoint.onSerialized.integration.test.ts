import { ConstraintError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { genTempDir, getError, given, then, when } from 'test-fns';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { onReferenced } from './runLambdaEndpoint.onReferenced';
import { onSerialized } from './runLambdaEndpoint.onSerialized';

const CONTEXT = {
  ...genContextLogTrail({ trail: null, env: null }),
  env: { access: 'test' as const },
};

/**
 * .what = a caller whose trail exid is PINNED, for the snapshot block
 * .why = the exid reaches the hydrated error's metadata, so a caller who
 *   propagates none makes the snapshot non-deterministic.
 *
 * ⚠️ a hardcoded `null` would also hold it still — and would pin the DEFECT.
 *    pin what a real caller supplies, so the snapshot holds the shape and the
 *    propagation at once (rule.require.hermetic-tests).
 */
const CONTEXT_PINNED = {
  ...genContextLogTrail({
    trail: { exid: 'exid:pinned-for-snapshot', stack: [] },
    env: null,
  }),
  env: { access: 'test' as const },
};

/**
 * .what = a caller whose debug emissions are RECORDED, for the diagnostic clamp
 * .why = the exid fallback is reported on the debug log, never in the return
 *        value, so the only way to assert it is to hold the emissions.
 *
 * .note = this records rather than replaces — every other method is spread
 *         through untouched, so no part of the run moves but observability
 *         (`rule.forbid.unit.remote-boundaries` bans a mock; this fakes none).
 */
const genContextRecorded = (
  base: typeof CONTEXT,
): { context: typeof CONTEXT; debugs: string[] } => {
  const debugs: string[] = [];
  return {
    debugs,
    context: {
      ...base,
      log: {
        ...base.log,
        debug: (message: string) => {
          debugs.push(message);
        },
      },
    },
  };
};

/**
 * .what = provisions a temp repo with a serverless.yml and a real handler file
 * .why = the local locus reads a serverless.yml off disk, so a hermetic test
 *        must supply one (rule.require.hermetic-tests)
 */
const genLocalRepo = (input: {
  service: string;
  function: string;
  handlerSource: string;
}): string => {
  const dir = genTempDir({ slug: 'run-lambda-endpoint-local' });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'temp' }));
  writeFileSync(
    join(dir, 'serverless.yml'),
    [
      `service: ${input.service}`,
      'functions:',
      `  ${input.function}:`,
      `    handler: handler.${input.function}`,
    ].join('\n'),
  );
  writeFileSync(join(dir, 'handler.js'), input.handlerSource);
  return dir;
};

describe('runLambdaEndpoint.onSerialized', () => {
  given('[case8] one handler, met from both sides of the boundary', () => {
    // a handler that rejects a caller fault. the SAME handler, the SAME input.
    const handlerSource = `
      exports.getServiceBySlug = async (payload) => {
        const event = payload && payload.event ? payload.event : payload;
        if (!event || !event.slug)
          return { error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'ConstraintError',
            message: 'slug is required',
          } };
        return { slug: event.slug, found: true };
      };
    `;

    when('[t0] the endpoint is met by REFERENCE', () => {
      then('a caller fault is RETURNED as an envelope', async () => {
        const handler = async (payload: any) => {
          const event = payload?.event ?? payload;
          if (!event?.slug)
            return {
              error: {
                _serde: 'LambdaEndpointError::contemp',
                class: 'ConstraintError',
                message: 'slug is required',
              },
            };
          return { slug: event.slug, found: true };
        };

        const result = await onReferenced({ event: {}, handler });

        // the host sees what the function returned
        expect(result).toHaveProperty('error');
      });
    });

    when('[t1] the SAME endpoint is met by SLUG, at local', () => {
      then('the same fault THROWS a ConstraintError', async () => {
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource,
        });

        // 🔴 the flip. one handler, one input, two boundaries, two stances —
        //    and both are right. a caller's bad request is not a lambda failure
        //    (invariant.badrequesterror-not-lambda-error), so the wire hydrates
        //    the envelope into a throw and the in-process host does not.
        await expect(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            CONTEXT,
          ),
        ).rejects.toThrow(ConstraintError);
      });
    });

    when('[t2] the endpoint succeeds, met by slug', () => {
      then('the output is returned plainly', async () => {
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource,
        });

        const result = await onSerialized<
          { slug: string },
          { slug: string; found: boolean }
        >(
          {
            which: { service: 'svc-example', function: 'getServiceBySlug' },
            event: { slug: 'surf-lesson' },
            at: 'local',
            from: dir,
          },
          CONTEXT,
        );

        expect(result).toEqual({ slug: 'surf-lesson', found: true });
      });
    });

    when('[t3] the ancient dialect crosses the serialized boundary', () => {
      then(
        'it hydrates to a ConstraintError too — both dialects agree',
        async () => {
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource: `
            exports.getServiceBySlug = async (event) => {
              if (!event || !event.slug)
                return { errorMessage: 'slug is required', errorType: 'BadRequestError' };
              return { slug: event.slug };
            };
          `,
          });

          await expect(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: {},
                at: 'local',
                struct: { payload: 'ancient' as const },
                from: dir,
              },
              CONTEXT,
            ),
          ).rejects.toThrow(ConstraintError);
        },
      );
    });

    /**
     * 🔴 the SHAPE clamp for this boundary — the LARGER of the two, at 519 sites
     *    against `onReferenced`'s 318.
     *
     * ⚠️ it lives HERE rather than in `publicSurfaceShapes.test.ts` because the
     *    local locus reads a `serverless.yml` off disk, which makes it an
     *    integration test (rule.forbid.unit.remote-boundaries).
     *
     * 🟡 the CLOUD locus stays unsnapshotted — it needs live aws credentials,
     *    which this host lacks.
     */
    when('[t8] the shapes this boundary answers with are pinned', () => {
      then('a success is the handler output, hydrated', async () => {
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource,
        });

        const result = await onSerialized<
          { slug: string },
          { slug: string; found: boolean }
        >(
          {
            which: { service: 'svc-example', function: 'getServiceBySlug' },
            event: { slug: 'surf-lesson' },
            at: 'local',
            from: dir,
          },
          CONTEXT_PINNED,
        );

        expect(result.found).toEqual(true);
        expect(result).toMatchSnapshot();
      });

      then(
        'a caller fault is a THROWN error, whose shape is pinned',
        async () => {
          // 🔴 the boundary flip, as a diff-visible artifact. on `onReferenced`
          //    this same handler RETURNS an envelope; here it throws. a reshape of
          //    the hydrated error is exactly the drift a field assertion misses.
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource,
          });

          const error = await getError(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: {},
                at: 'local',
                from: dir,
              },
              CONTEXT_PINNED,
            ),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect({
            class: error.constructor.name,
            message: error.message,
          }).toMatchSnapshot();
        },
      );

      then('the ancient dialect hydrates to the SAME class', async () => {
        // the pair is the contract: two envelope shapes on the wire, one thrown
        // class at the caller. the snapshot makes that agreement legible.
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource: `
            exports.getServiceBySlug = async (event) => {
              if (!event || !event.slug)
                return { errorMessage: 'slug is required', errorType: 'BadRequestError' };
              return { slug: event.slug };
            };
          `,
        });

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              struct: { payload: 'ancient' as const },
              from: dir,
            },
            CONTEXT_PINNED,
          ),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect({
          class: error.constructor.name,
          message: error.message,
        }).toMatchSnapshot();
      });
    });

    /**
     * 🔴 the LOCUS-FIDELITY clamp — the local locus must deliver the runtime
     *    identity the wire would. absent it, a handler sees
     *    `functionName: 'run-lambda-endpoint'` where aws sends the slug, and F6
     *    names `functionName` the one field a handler legitimately branches on.
     *
     * ⚠️ the `[t8]` snapshots do NOT cover this. they read the exid on the
     *    hydrated error, never the exid in the payload the handler received —
     *    two fields, one name.
     */
    when('[t9] the local locus stands in for the wire', () => {
      // a handler that reports back what the runtime handed it, so the test can
      // assert on the CONTEXT rather than on the output alone
      const reporterSource = `
        exports.getServiceBySlug = async (payload, context) => ({
          functionName: context.functionName,
          logGroupName: context.logGroupName,
          exidSeen: payload && payload.trail ? payload.trail.exid : null,
        });
      `;

      then(
        'the handler sees the endpoint SLUG as its functionName',
        async () => {
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource: reporterSource,
          });

          const result = await onSerialized<
            Record<string, never>,
            { functionName: string; logGroupName: string }
          >(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            CONTEXT,
          );

          // the slug IS the aws function name (define.lambda-endpoint-ubiqlang),
          // so this is the exact string the cloud locus would have delivered
          expect(result.functionName).toEqual(
            'svc-example-test-getServiceBySlug',
          );
          expect(result.logGroupName).toEqual(
            '/aws/lambda/svc-example-test-getServiceBySlug',
          );

          expect({
            functionName: result.functionName,
            logGroupName: result.logGroupName,
          }).toMatchSnapshot();
        },
      );

      then('the caller trail exid crosses the boundary', async () => {
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource: reporterSource,
        });

        const result = await onSerialized<
          Record<string, never>,
          { exidSeen: string | null }
        >(
          {
            which: { service: 'svc-example', function: 'getServiceBySlug' },
            event: {},
            at: 'local',
            from: dir,
          },
          CONTEXT,
        );

        // the cloud locus puts an exid in the payload (askLambdaEndpoint.ts:78).
        // asserted by SHAPE, never by value — the exid is invented when the
        // caller propagates none, so its PRESENCE and prefix are pinnable and
        // its value is not.
        expect(result.exidSeen).toEqual(expect.stringContaining('exid:'));

        // 🔴 the volatile half is MASKED into derived booleans rather than
        //    carved out, so a refactor that stops the propagation, or that
        //    propagates a value with no `exid:` prefix, is a red diff.
        expect({
          exidPresent: typeof result.exidSeen === 'string',
          exidCarriesPrefix: String(result.exidSeen).startsWith('exid:'),
        }).toMatchSnapshot();
      });

      /**
       * 🔴 the DIAGNOSTIC half of that parity — the PAIR is the claim: the warn
       *    fires exactly when the exid was generated.
       *
       * `getExidFromContext` logs naught of its own — it returns `source`, and
       * each locus must report the fallback itself, so the two can diverge in
       * silence.
       */
      then(
        'a caller who sends NO trail is warned, as the cloud locus warns',
        async () => {
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource: reporterSource,
          });
          const recorded = genContextRecorded(CONTEXT);

          await onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            recorded.context,
          );

          expect(recorded.debugs).toContain('trail.exid.generated');
        },
      );

      then(
        'a caller who SENDS a trail is not warned — it was extracted, not invented',
        async () => {
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource: reporterSource,
          });
          const recorded = genContextRecorded(CONTEXT_PINNED);

          await onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            recorded.context,
          );

          expect(recorded.debugs).not.toContain('trail.exid.generated');
        },
      );
    });

    /**
     * 🔴 the MALFUNCTION clamp.
     *
     * a constraint fault is RETURNED, so it flows through the shared hydration
     * and both loci agree. a malfunction is THROWN, so the local locus must wash
     * it to the wire shape the cloud locus hydrates — else the same handler
     * fault yields two classes per `at`, which is what the sub-axis exists to
     * make impossible.
     */
    when('[t4] the handler MALFUNCTIONS on the local locus', () => {
      const genMalfunctionRepo = (): string =>
        genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource: `
            exports.getServiceBySlug = async () => {
              throw new Error('the wave report service is down');
            };
          `,
        });

      then(
        'it throws — a malfunction is never a returned envelope',
        async () => {
          const error = await getError(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: {},
                at: 'local',
                from: genMalfunctionRepo(),
              },
              CONTEXT,
            ),
          );

          expect(error).toBeDefined();
          expect(error.message).toContain('the wave report service is down');
        },
      );

      then(
        'it is NOT a ConstraintError — the fault is the server’s',
        async () => {
          // the two hydration arms must stay apart: a caller fault and a server
          // fault arrive as different classes, on either locus.
          const error = await getError(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: {},
                at: 'local',
                from: genMalfunctionRepo(),
              },
              CONTEXT,
            ),
          );

          expect(error).not.toBeInstanceOf(ConstraintError);
        },
      );

      then('it carries the endpoint, as the wire hydration does', async () => {
        // 🔴 the point of the repair: the throw crosses the SAME hydration the
        //    cloud locus uses, so it arrives enriched rather than raw. a bare
        //    `Error` from the handler carries no endpoint at all.
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: genMalfunctionRepo(),
            },
            CONTEXT,
          ),
        );

        expect(JSON.stringify(error)).toContain('svc-example');

        expect({
          isConstraintError: error instanceof ConstraintError,
          messageNamesFault: error.message.includes(
            'the wave report service is down',
          ),
          carriesEndpoint: JSON.stringify(error).includes('svc-example'),
        }).toMatchSnapshot();
      });

      /**
       * 🔴 the LOSS is the guarantee. aws sends no `metadata` and no `cause` — a
       *    thrown error crosses a process as `{ errorMessage, errorType,
       *    stackTrace }` and no more.
       *
       * ⇒ a local locus that PRESERVED them would hand the author a richer error
       *   than the cloud locus can ever produce, so `at` would alter the contract
       *   it exists to hold constant. a test that asserted on `metadata` would
       *   pass locally and fail against the wire.
       */
      then('it does NOT carry metadata — the wire sends none', async () => {
        const repoWithMetadata = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource: `
            exports.getServiceBySlug = async () => {
              const error = new Error('the wave report service is down');
              error.metadata = { surfSpot: 'pipeline', attempt: 3 };
              throw error;
            };
          `,
        });

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: repoWithMetadata,
            },
            CONTEXT,
          ),
        );

        // the message survives — it is a field aws sends
        expect(error.message).toContain('the wave report service is down');

        // the metadata does not — aws sends no such field, so neither may we
        expect(JSON.stringify(error)).not.toContain('pipeline');
      });
    });

    when('[t5] the arity of each subdomain is inspected', () => {
      then(
        'onReferenced accepts NO `at` — the barred cell is unwritable',
        () => {
          // referenced × cloud is impossible by nature: a function reference cannot
          // cross a process. the bar is enforced by ARITY, never by a runtime check
          // (rule.prefer.prevent-over-correct, rung 1).
          //
          // 🟡 so the clamp is a TYPE. `hasAt` reads the REAL input type — it
          //    resolves `true` the day `at` becomes a legal key, at which point
          //    this line stops to compile. `tsc` bites; the expect is its carrier.
          const hasAt: 'at' extends keyof Parameters<typeof onReferenced>[0]
            ? true
            : false = false;

          expect(hasAt).toEqual(false);
        },
      );
    });

    // 🔴 the ABSENT event, clamped on BOTH loci.
    //
    //    the referenced twin guards this too, and DELEGATION IS NOT ENOUGH:
    //    the cloud locus never reaches the twin (it hands the event to
    //    `askLambdaEndpoint`, whose `JSON.stringify` drops an `undefined` key),
    //    and the local locus reaches it and then washes its throw through
    //    `asWireFunctionErrorPayload`, which carries no `hint`.
    //
    //    ⇒ so a guard on one boundary would answer one locus 90 seconds late
    //      and the other stripped of the field that names the fix.
    when('[t6] the whole event is undefined', () => {
      // 🔴 the CLOUD teeth. this suite has no aws credentials, so a run that
      //    actually reached the wire fails with a credential or network fault —
      //    never a named ConstraintError that holds our own message. so this
      //    assertion IS the proof the wire was never touched (case=9).
      then('the CLOUD locus refuses without a wire trip', async () => {
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-home-services', function: 'getSvc' },
              event: undefined as unknown as { slug: string },
              at: 'cloud',
            },
            CONTEXT,
          ),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('no event was given');

        expect({
          class: error.constructor.name,
          messageNamesNoEvent: error.message.includes('no event was given'),
        }).toMatchSnapshot();
      });

      // 🔴 the LOCAL teeth, and this one needs a REAL repo to be honest — the
      //    yml must RESOLVE, or the lookup fails before the event is ever read
      //    and the test bites for the wrong reason.
      //
      // ⇒ the HINT is what proves WHERE it failed: `onReferenced` throws the
      //   same message, and `asWireFunctionErrorPayload` carries no metadata, so
      //   a hint here can only come from a guard that fired before delegation.
      then('the LOCAL locus refuses with the hint intact', async () => {
        const dir = genLocalRepo({
          service: 'svc-surf',
          function: 'getWaveByUuid',
          handlerSource:
            'exports.getWaveByUuid = async () => ({ found: true });',
        });

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-surf', function: 'getWaveByUuid' },
              event: undefined as unknown as { slug: string },
              at: 'local',
              from: dir,
            },
            CONTEXT,
          ),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('no event was given');

        const hint = String(
          (error as unknown as { metadata?: { hint?: unknown } }).metadata
            ?.hint ?? '',
        );
        expect(hint).toContain('event: {}');

        expect({
          class: error.constructor.name,
          hintNamesEmptyEvent: hint.includes('event: {}'),
        }).toMatchSnapshot();
      });
    });

    // 🔴 an UNKNOWN locus is refused. the branch reads `if (at === 'cloud') …`,
    //    so every other value — an `at` from config, a js consumer, a lowercase
    //    typo — falls to the LOCAL path and runs in-process while the caller
    //    believes they hit a deployed lambda.
    //
    //    ⚠️ the fall-through DIRECTION is the hazard: a fall to `'cloud'` fails
    //       loud on a real invoke; a fall to `'local'` answers from a
    //       serverless.yml and reads as a pass.
    when('[t7] the locus is not one this util runs', () => {
      then('an unknown `at` is refused by name', async () => {
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-surf', function: 'getWaveByUuid' },
              event: { slug: 'x' },
              at: 'CLOUD' as unknown as 'cloud',
            },
            CONTEXT,
          ),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('locus');

        // it names BOTH options, so the fix needs no doc read
        const serialized = JSON.stringify(error);
        expect(serialized).toContain('cloud');
        expect(serialized).toContain('local');

        expect({
          class: error.constructor.name,
          namesBothLoci:
            serialized.includes('cloud') && serialized.includes('local'),
        }).toMatchSnapshot();
      });

      // 🔴 the TEETH. without the guard an unknown locus falls to the LOCAL
      //    path, which fails on `'no serverless.yml found'` — plausible, and
      //    never about the yml.
      //
      // ⚠️ assert the LOCAL path's EXACT message, never the bare substring
      //    `'serverless.yml'` — the guard's own hint names that file, so a
      //    substring assertion goes red against the CORRECT behavior.
      then('it does NOT fall through to the local lookup', async () => {
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-surf', function: 'getWaveByUuid' },
              event: { slug: 'x' },
              at: 'mars' as unknown as 'cloud',
            },
            CONTEXT,
          ),
        );

        expect(error.message).not.toContain('no serverless.yml found');
        expect(error.message).toContain('locus');
      });
    });
  });

  given('[case10] a serverless.yml whose handler path is stale', () => {
    when('[t0] the handler file does not exist', () => {
      then('the error blames the CONFIG, never the handler', async () => {
        const dir = genTempDir({ slug: 'run-lambda-endpoint-stale' });
        writeFileSync(
          join(dir, 'package.json'),
          JSON.stringify({ name: 'temp' }),
        );
        writeFileSync(
          join(dir, 'serverless.yml'),
          [
            'service: svc-example',
            'functions:',
            '  getServiceBySlug:',
            '    handler: src/moved/away.getServiceBySlug',
          ].join('\n'),
        );

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            CONTEXT,
          ),
        );

        // 🔴 case=10: the incumbent surfaces a bare module error and the author
        //    debugs the handler that never loaded. name the real fault + the fix.
        expect(error.message).toContain('handler file that does not exist');
        expect(JSON.stringify(error)).toContain('serverless.yml#functions');

        expect({
          messageBlamesConfig: error.message.includes(
            'handler file that does not exist',
          ),
          namesServerlessYml: JSON.stringify(error).includes(
            'serverless.yml#functions',
          ),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the serverless.yml names a different service', () => {
      then('the error names both, so the mismatch is visible', async () => {
        const dir = genLocalRepo({
          service: 'svc-other',
          function: 'getServiceBySlug',
          handlerSource: 'exports.getServiceBySlug = async () => ({});',
        });

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: {},
              at: 'local',
              from: dir,
            },
            CONTEXT,
          ),
        );

        expect(error.message).toContain('different service');
        expect(JSON.stringify(error)).toContain('svc-other');
        expect(JSON.stringify(error)).toContain('svc-example');

        expect({
          messageNamesMismatch: error.message.includes('different service'),
          namesBothServices:
            JSON.stringify(error).includes('svc-other') &&
            JSON.stringify(error).includes('svc-example'),
        }).toMatchSnapshot();
      });
    });

    when('[t2] the function is absent from serverless.yml', () => {
      then('the error lists what IS declared', async () => {
        const dir = genLocalRepo({
          service: 'svc-example',
          function: 'getServiceBySlug',
          handlerSource: 'exports.getServiceBySlug = async () => ({});',
        });

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getOtherThing' },
              event: {},
              at: 'local',
              from: dir,
            },
            CONTEXT,
          ),
        );

        expect(error.message).toContain('no such function');
        // the fix needs the valid set, per rule.require.errors-name-the-fix
        expect(JSON.stringify(error)).toContain('getServiceBySlug');

        expect({
          messageNamesAbsence: error.message.includes('no such function'),
          listsValidFunctions:
            JSON.stringify(error).includes('getServiceBySlug'),
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = clamps that this sdk's OWN guards keep their hints STRUCTURED on both
   *         loci
   * .why = the local locus wraps its delegation in `.catch(asWireFunctionErrorPayload)`,
   *   which keeps only the three fields aws puts on the wire. that wash is correct
   *   for a handler's own error (`[t4]`), so the guards run AHEAD of the
   *   delegation rather than inside it.
   *
   * ⚠️ the clamp reads `metadata.hint`, never `JSON.stringify(error)` — a
   *    stringify check passes with the guard on either side of the wash, so it
   *    has no teeth.
   */
  given('[case18] a callback-style handler, on each boundary', () => {
    const HANDLER_CALLBACK_SOURCE = [
      'exports.getServiceBySlug = function (event, context, callback) {',
      '  callback(null, { ok: true });',
      '};',
    ].join('\n');

    when('[t0] the SERIALIZED boundary loads it from serverless.yml', () => {
      then(
        'the error keeps its hint, so the fix is one step away',
        async () => {
          const dir = genLocalRepo({
            service: 'svc-example',
            function: 'getServiceBySlug',
            handlerSource: HANDLER_CALLBACK_SOURCE,
          });

          const error = await getError(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: {},
                at: 'local',
                from: dir,
              },
              CONTEXT,
            ),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('callback-style');

          // 🔴 the STRUCTURED hint is the assertion with teeth. a
          //    `JSON.stringify(error).toContain(…)` check would NOT bite —
          //    measured — because the wash keeps `stackTrace`, and the hint text
          //    sits inside it either way. the FIELD is what the wash eats.
          const metadata = (error as ConstraintError).metadata as Record<
            string,
            unknown
          >;
          expect(metadata.declaredParameters).toEqual(3);
          expect(metadata.hint).toContain(
            'answer with a promise instead of a callback',
          );

          expect({
            class: error.constructor.name,
            messageNamesCallbackStyle: error.message.includes('callback-style'),
            declaredParameters: metadata.declaredParameters,
            hintNamesFix: String(metadata.hint).includes(
              'answer with a promise instead of a callback',
            ),
          }).toMatchSnapshot();
        },
      );
    });

    when('[t1] the REFERENCED boundary is handed it directly', () => {
      then('the two loci agree, which is the whole point', async () => {
        // ✅ the cast is the POINT. without it this line does not compile —
        //    `TS2322: Target signature provides too few arguments. Expected 3
        //    or more, but got 2.`
        //
        //    ⇒ so the referenced boundary refuses a callback handler at COMPILE
        //      time, and the runtime guard covers the path tsc cannot see: a
        //      handler imported `any`-typed, which is the routine case.
        const handlerFromAnUntypedImport = ((
          _event: unknown,
          _context: unknown,
          _callback: unknown,
        ) => undefined) as never;

        const error = await getError(
          onReferenced({ event: {}, handler: handlerFromAnUntypedImport }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('callback-style');

        // the same structured read as `[t0]` — that identity IS the claim
        const metadata = (error as ConstraintError).metadata as Record<
          string,
          unknown
        >;
        expect(metadata.declaredParameters).toEqual(3);
        expect(metadata.hint).toContain(
          'answer with a promise instead of a callback',
        );

        // 🔴 the two snapshots must read IDENTICALLY — that identity is what
        //    `[case18]` claims, and a masked pair makes a drift between the
        //    boundaries a red diff rather than a silent divergence
        expect({
          class: error.constructor.name,
          messageNamesCallbackStyle: error.message.includes('callback-style'),
          declaredParameters: metadata.declaredParameters,
          hintNamesFix: String(metadata.hint).includes(
            'answer with a promise instead of a callback',
          ),
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = case=9 `[t1]` — the credential-free reject that NAMES THE FIX
   * .why = an absent credential is the one aws fault a developer fixes in ONE
   *   command, and aws's own message names no env, no owner, and no command.
   *
   * ✅ it needs no aws at all — `context.aws.lambda.sdk` is injectable, so a stub
   *    that throws a `CredentialsProviderError` reaches the same catch an expired
   *    sso session reaches.
   *
   * 🟡 the chain WALK is not clamped here — `executeLambdaInvocation`
   *    interpolates `${error.message}`, so *"credentials"* reaches the top level
   *    regardless. it is clamped at `[case2]` of `throwIfCredentialsError.test.ts`.
   */
  given('[case17] the caller holds no aws credentials', () => {
    /**
     * .what = a LambdaClient whose every call fails the way aws-sdk v3 fails
     * .why = reproduces an expired-or-absent sso session with no aws reached, and
     *        no env to scrub — the credential chain's failure is what is under
     *        test, never the chain itself
     */
    const genSdkWithNoCredentials = (): never => {
      const error = new Error('Could not load credentials from any providers');
      error.name = 'CredentialsProviderError';
      return {
        send: async (): Promise<never> => {
          throw error;
        },
      } as never;
    };

    when('[t0] a cloud invoke is attempted', () => {
      then('it rejects with an error that NAMES THE FIX', async () => {
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: { slug: 'surf-lesson' },
              at: 'cloud',
            },
            {
              ...CONTEXT,
              aws: { lambda: { sdk: genSdkWithNoCredentials() } },
            },
          ),
        );

        // caller-must-fix, because at THIS boundary the caller is a developer
        // with a terminal — `throwIfCredentialsError` records why the runtime
        // path is deliberately excluded.
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.constructor.name).toEqual('LambdaCredentialsAbsentError');

        // 🔴 the assertion with TEETH. aws's own message — *"Could not load
        //    credentials from any providers"* — names no env, no owner, and no
        //    command, so a `toContain('credentials')` check passes on the RAW
        //    aws error and proves naught. the HINT is the whole claim
        //    (`rule.require.errors-name-the-fix`).
        const metadata = (error as ConstraintError).metadata as Record<
          string,
          unknown
        >;
        expect(String(metadata.hint)).toContain('keyrack unlock');
        expect(metadata.at).toEqual('cloud');

        // masked to the deterministic fields — the raw metadata may carry a
        // generated exid, since this block uses the unpinned CONTEXT
        expect({
          class: error.constructor.name,
          at: metadata.at,
          hintNamesKeyrackUnlock: String(metadata.hint).includes(
            'keyrack unlock',
          ),
        }).toMatchSnapshot();
      });

      then('the original aws error is kept as the cause', async () => {
        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: { slug: 'surf-lesson' },
              at: 'cloud',
            },
            {
              ...CONTEXT,
              aws: { lambda: { sdk: genSdkWithNoCredentials() } },
            },
          ),
        );

        // 🔴 the aws fault sits TWO levels down — `executeLambdaInvocation`
        //    wraps it before this boundary sees it:
        //
        //      LambdaCredentialsAbsentError → LambdaEndpointError → CredentialsProviderError
        //
        //    ⇒ so the clamp walks the chain, and so does `getIsCredentialsError`.
        //
        // ⚠️ each layer labels itself differently, so take the more specific of
        //    the two labels — `helpful-errors` leaves `.name` as `'Error'`, and
        //    the aws fault is a plain Error with `.name` renamed.
        const asErrorLabel = (from: Error): string =>
          from.name === 'Error' ? from.constructor.name : from.name;

        const getAllErrorNames = (from: unknown): string[] => {
          if (!(from instanceof Error)) return [];
          const cause =
            (from as { cause?: unknown }).cause ??
            (from as { metadata?: { cause?: unknown } }).metadata?.cause;
          return [asErrorLabel(from), ...getAllErrorNames(cause)];
        };

        expect(getAllErrorNames(error)).toEqual([
          'LambdaCredentialsAbsentError',
          'LambdaEndpointError',
          'CredentialsProviderError',
        ]);
      });
    });

    when('[t1] the sdk fails for a reason that is NOT credentials', () => {
      then('the error passes through untouched', async () => {
        const faultUnrelated = new Error('Rate exceeded');
        faultUnrelated.name = 'TooManyRequestsException';

        const error = await getError(
          onSerialized(
            {
              which: { service: 'svc-example', function: 'getServiceBySlug' },
              event: { slug: 'surf-lesson' },
              at: 'cloud',
            },
            {
              ...CONTEXT,
              aws: {
                lambda: {
                  sdk: {
                    send: async (): Promise<never> => {
                      throw faultUnrelated;
                    },
                  } as never,
                },
              },
            },
          ),
        );

        // 🔴 the anti-vacuous clamp (`rule.forbid.failhide`). a mapper that named
        //    EVERY failure a credentials fault passes `[t0]` and tells a
        //    developer to unlock their keyrack when the endpoint was rate-limited.
        //
        //  ⚠️ *"untouched"* means *"this boundary added no layer"* — the invoke
        //     path wraps every fault in a `LambdaEndpointError` before this
        //     boundary (`[t0]`'s chain walk), so the raw name lives one level down.
        expect(error).not.toBeInstanceOf(ConstraintError);
        expect(error.name).toEqual('LambdaEndpointError');
        expect(error.message).toContain('Rate exceeded');
        expect(
          (error as unknown as { metadata?: { hint?: unknown } }).metadata
            ?.hint,
        ).toBeUndefined();

        // 🔴 the ABSENT hint is the whole claim, and an absence is what a field
        //    read defends worst: `metadata?.hint` reads `undefined` whether the
        //    key is absent OR the metadata bag is. the snapshot pins it beside
        //    `[t0]`'s `hintNamesKeyrackUnlock: true`, so the pair reads as the
        //    contrast it is.
        expect({
          name: error.name,
          messageContainsRateExceeded: error.message.includes('Rate exceeded'),
          hintAbsent:
            (error as unknown as { metadata?: { hint?: unknown } }).metadata
              ?.hint === undefined,
        }).toMatchSnapshot();
      });
    });
  });
});
