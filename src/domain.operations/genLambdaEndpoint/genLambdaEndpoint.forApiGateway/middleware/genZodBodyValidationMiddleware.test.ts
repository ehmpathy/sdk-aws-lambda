import { DomainEntity, DomainLiteral } from 'domain-objects';
import { ConstraintError, getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import type { UnifiedApiGatewayEvent } from '../UnifiedApiGatewayEvent';
import { genZodBodyValidationMiddleware } from './genZodBodyValidationMiddleware';

/**
 * .what = the same two dobjs the event-border twin declares — a literal nested inside an entity
 * .why = `getValidatedInput` is ONE primitive, and BOTH families reach it, so the coerce owes a
 *        clamp at BOTH slots. before this file `genZodBodyValidationMiddleware` — this family's
 *        only reader of that primitive — carried no test, while its twin
 *        `genZodEventValidationMiddleware` carried six coerce cases. so "one primitive, both
 *        families" was proven on one of the two (rule.require.sweep-the-defect-class)
 *
 * ⚠️ .note = an earlier draft of the line above read "the `forApiGateway` family had no test at
 *            all", and a peer review asked what search proved it. the search proved it FALSE:
 *            `globsafe 'src/…/genLambdaEndpoint.forApiGateway/**\/*.test.ts'` returns 8 files
 *            today and 7 on `origin/main` — the family was well covered, and exactly one
 *            subject was not. the control that makes the corrected claim sound is a pair:
 *            that same glob reaches this directory (8 hits, so no zero here is an artifact),
 *            and `git ls-tree origin/main <family>` lists `genZodBodyValidationMiddleware.ts`
 *            with no `.test.ts` beside it (rule.require.positive-control-before-absence-claims)
 *
 * .note = this slot carries a failure mode the twin does not: `deserialize: { body: false }`
 *         leaves a raw STRING in `event.body`, so the coerce meets a string rather than an
 *         object. `[case5]` measures what that emits
 */
interface SurfSpot {
  name: string;
  breakType: string;
}
class SurfSpot extends DomainLiteral<SurfSpot> implements SurfSpot {
  public static schema = z.object({ name: z.string(), breakType: z.string() });
}

interface Surfer {
  uuid: string;
  handle: string;
  home: SurfSpot;
}
class Surfer extends DomainEntity<Surfer> implements Surfer {
  public static primary = ['uuid'] as const;
  public static unique = ['handle'] as const;
  public static nested = { home: SurfSpot };
  public static schema = z.object({
    uuid: z.string(),
    handle: z.string(),
    home: SurfSpot.contract(),
  });
}

/**
 * .what = a dobj whose CONSTRUCTOR demands more than its schema does
 * .why = the wish asks that a dobj which fails its construction-time validation fails loud at
 *        the boundary. the schema cannot stand in for that check: the coerce runs
 *        `X.build(props, { skip: { schema: true } })`, so the schema is deliberately NOT re-run
 *        at construct time and the two can genuinely disagree
 *        (`domain-objects/dist/manipulation/getContract.js:132,150`)
 *
 * .note = declared IDENTICALLY to the twin's `GuardedSpot`, deliberately. the claim under test
 *         is that one primitive serves both slots, so the fixture must not vary — a difference
 *         here would make a divergence in result unattributable
 */
interface GuardedSpot {
  name: string;
}
class GuardedSpot extends DomainLiteral<GuardedSpot> implements GuardedSpot {
  public static schema = z.object({ name: z.string() }); // <-- accepts ''
  constructor(props: GuardedSpot) {
    super(props);
    if (props.name.trim() === '')
      throw new Error('a surf spot must carry a name');
  }
}

describe('genZodBodyValidationMiddleware', () => {
  /**
   * .note = the harness hands back the WHOLE event beside the parsed body, because one claim
   *         below is about the event's PEER fields rather than the body: `@middy/http-cors`
   *         reads `httpMethod` and `headers` off `request.event` in its `after` hook, and this
   *         middleware must leave both readable at the top level (see the subject's own `.note`)
   *
   * .note = every cast lives HERE, never at a call site (rule.require.named-transformers)
   *
   * .as = SIX casts, in three groups, each with its own removal path (rule.forbid.as-cast):
   *       — middy's request shape (`context`, `error`, the request literal): its
   *         `MiddlewareFn` parameter carries aws-lambda fields a test never supplies.
   *         these drop together if middy ever ships a request builder
   *       — the PARTIAL event: `UnifiedApiGatewayEvent` declares nine fields and this
   *         harness supplies the three the subject and the assertions touch. drops if the
   *         harness builds a complete event, which would bury the three that matter
   *       — the READ-BACK (`request.event`, `.body`): middy types `event` as `any`, and
   *         `UnifiedApiGatewayEvent.body` is declared as the PRE-parse shape by design.
   *         drops once the chain carries `inputAfter` in its own slot — the 🚧 F31 fulcrum
   *         the subject's own `.removal` names
   */
  const invokeMiddleware = async <T>(
    schema: z.ZodSchema<T>,
    body: unknown,
  ): Promise<{ bodyAfter: T; event: UnifiedApiGatewayEvent }> => {
    const middleware = genZodBodyValidationMiddleware({ schema });
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    } as unknown as UnifiedApiGatewayEvent;
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);

    const eventAfter = request.event as UnifiedApiGatewayEvent;
    return { bodyAfter: eventAfter.body as unknown as T, event: eventAfter };
  };

  given('[case1] a valid body', () => {
    const schema = z.object({ name: z.string(), age: z.number() });

    when('[t0] validated', () => {
      then('the parsed value replaces the body', async () => {
        const { bodyAfter } = await invokeMiddleware(schema, {
          name: 'alice',
          age: 30,
        });
        expect(bodyAfter).toEqual({ name: 'alice', age: 30 });
      });
    });
  });

  given('[case2] an invalid body', () => {
    const schema = z.object({ name: z.string(), age: z.number() });

    when('[t0] validated', () => {
      then('it throws a ConstraintError', async () => {
        const error = await getError(
          invokeMiddleware(schema, { name: 123, age: 'nope' }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
      });
    });
  });

  given('[case3] a dobj at the BODY border', () => {
    // .why = the twin proves this at `request.event`. the guarantee belongs to the primitive, so
    //        it must hold at this slot too — otherwise "one primitive, both families" is prose
    const schema = z.object({ surfer: Surfer.contract() });
    const wire = {
      surfer: {
        uuid: 'u1',
        handle: 'crush',
        home: { name: 'pipeline', breakType: 'reef' },
      },
    };

    when('[t0] validated', () => {
      /**
       * ⚠️ .why ONE invocation, shared = the two `then` rows below assert about ONE coerce, so
       *         they must grade ONE run. re-invoked per row they grade two, which reads as a
       *         single verdict while it is a pair — the exact hazard `[case5]` records two cases
       *         down, and the same shared-promise form is the fix
       *         (rule.forbid.redundant-expensive-operations)
       *
       * .note = a plain promise rather than `useThen`, for the reason `[case5]` transcribes:
       *         `useThen`'s proxy serves an `Object.assign` copy once its registered test
       *         completes, which takes own-enumerable props only and so drops the prototype
       *         `toBeInstanceOf` reads. a promise awaited twice still runs once
       */
      const validated = invokeMiddleware(schema, wire);

      then('the field arrives as a real Surfer instance', async () => {
        expect((await validated).bodyAfter.surfer).toBeInstanceOf(Surfer);
      });

      then('its NESTED dobj arrives as a real SurfSpot too', async () => {
        expect((await validated).bodyAfter.surfer.home).toBeInstanceOf(
          SurfSpot,
        );
      });
    });
  });

  given('[case4] an event whose peer fields cors will read', () => {
    // .why = the subject's own `.note` states the constraint: whatever occupies `request.event`
    //        when cors's `after` hook runs must keep `httpMethod` and `headers` readable at the
    //        top level, under v1 names. that invariant had no clamp, so a future input translate
    //        could break cors with a green suite (rule.require.read-the-slot-a-dependency-reads)
    const schema = z.object({ surfer: Surfer.contract() });

    when('[t0] the body is validated and replaced', () => {
      then('httpMethod and headers survive at the top level', async () => {
        const { event } = await invokeMiddleware(schema, {
          surfer: {
            uuid: 'u1',
            handle: 'crush',
            home: { name: 'pipeline', breakType: 'reef' },
          },
        });
        expect(event.httpMethod).toEqual('POST');
        expect(event.headers).toEqual({ 'content-type': 'application/json' });
      });
    });
  });

  given(
    '[case5] a raw STRING body, as `deserialize: { body: false }` leaves it',
    () => {
      // .why = the one failure mode this slot has and its twin does not. the vision names this
      //        edge case and PREDICTED the message; this case measures it instead
      const schema = z.object({ surfer: Surfer.contract() });

      when('[t0] the coerce meets a string rather than an object', () => {
        /**
         * ⚠️ .why ONE invocation, shared = three `then` blocks each re-ran the middleware, so the
         *         three assertions graded three DIFFERENT runs. for a deterministic subject that
         *         is merely triple work; the hazard is that it reads as one verdict while it is
         *         three, so a result that varied between them could keep every row green
         *         (rule.forbid.redundant-expensive-operations)
         *
         * ⚠️ .why a shared PROMISE rather than `useThen` = measured, and the twin file carries
         *         the full transcript. `useThen`'s proxy deletes its `get` trap once its
         *         registered test completes and then serves an `Object.assign` copy, which
         *         takes OWN ENUMERABLE props only — so an error arrives with no `message`
         *         (non-enumerable) and no prototype (`toBeInstanceOf` reads `Object`).
         *         a promise awaited N times still runs once, which is the guarantee wanted here
         */
        const refusal = getError(
          invokeMiddleware(schema, '{"surfer":{"uuid":"u1"}}'),
        );

        then('it throws a ConstraintError rather than a crash', async () => {
          expect(await refusal).toBeInstanceOf(ConstraintError);
        });

        then('the message names the shape mismatch', async () => {
          expect((await refusal).message).toContain(
            'expected object, received string',
          );
        });

        then('the whole surface a caller meets is snapped', async () => {
          expect((await refusal).message).toMatchSnapshot();
        });
      });
    },
  );

  given('[case6] a NULL body, the other shape the same option produces', () => {
    /**
     * .why = `deserialize: { body: false }` hands `input.payload.body` straight through
     *        (`asUnifiedApiGatewayEvent.ts:71-76`), and aws types that slot `string | null` —
     *        so the option has TWO arms, never one. `[case5]` clamps the string; a GET with no
     *        body takes this arm, which is the more common of the two
     *
     * .note = the null arm reaches the SAME slot on the DEFAULT path too: a request with no body
     *         parses to `null` whether or not the caller disarmed the deserialize. so this is an
     *         axis of `[case5]`'s cause rather than a peer of it
     *         (rule.require.sweep-the-defect-class — sweep every axis the cause leaves unstated)
     */
    const schema = z.object({ surfer: Surfer.contract() });

    when('[t0] the coerce meets null rather than an object', () => {
      // .why ONE invocation, shared = the same reason `[case5]` gives, one axis over — and
      //      the same shared-promise form, for the same measured reason
      const refusal = getError(invokeMiddleware(schema, null));

      then('it throws a ConstraintError rather than a crash', async () => {
        expect(await refusal).toBeInstanceOf(ConstraintError);
      });

      then('the message names null, never the string case', async () => {
        expect((await refusal).message).toContain(
          'expected object, received null',
        );
      });

      then('the whole surface a caller meets is snapped', async () => {
        expect((await refusal).message).toMatchSnapshot();
      });
    });
  });

  given('[case7] a body the SCHEMA accepts and the CONSTRUCTOR rejects', () => {
    /**
     * .what = the wish's fail-loud acceptance line, at THIS slot
     * .why = the twin proves it at `request.event` (`genZodEventValidationMiddleware.test.ts`
     *        `[case11]`), and it was the one acceptance line with SINGLE-family coverage while
     *        every other line on this branch uses the one-primitive-both-families pattern
     *
     * ⚠️ .why the earlier sweep MISSED it = this file's header records a sweep that closed the
     *         coerce gap at this slot — identity, arrays, nested, string, null. that sweep
     *         followed the cause *"a dobj at the body border owes the twin's coerce cases"*,
     *         and a constructor rejection is not a coerce case: it is the coerce REFUSING.
     *         so the cause was swept on the shapes axis and left unswept on the OUTCOME axis
     *         (rule.require.sweep-the-defect-class — sweep every axis the cause leaves
     *         unstated)
     *
     * ⚠️ .the bite, MEASURED = the constructor's `throw` was struck and this file re-run:
     *         **3 failed, 12 passed** — `[t0]`'s three rows go RED, and `[t1]` stays GREEN.
     *         the green one is what proves the clamp is SCOPED: it asserts the body that
     *         SHOULD construct still does, so it cannot depend on the refusal. a clamp whose
     *         every row moved would prove only that the fixture is reachable
     *         (rule.require.clamp-edge-cases)
     *
     * .note = this stops at the `ConstraintError`, deliberately. the 400 it becomes on the wire
     *         is already clamped at the endpoint grain, and by ONE mechanism that does not care
     *         which `ConstraintError` it met — `genLambdaEndpoint.forApiGateway.test.ts:113`,
     *         `:405`, `:443`, `:1119`. to re-prove the status here would clamp middy's chain a
     *         fifth time and this subject not at all
     */
    const schema = z.object({ spot: GuardedSpot.contract() });

    when('[t0] the body passes the schema', () => {
      // .why ONE invocation, shared = the same reason `[case5]` and `[case6]` give, and the
      //      same shared-promise form, for the same measured `useThen` reason
      const refusal = getError(
        invokeMiddleware(schema, { spot: { name: '   ' } }),
      );

      then('it is refused, as a ConstraintError', async () => {
        expect(await refusal).toBeInstanceOf(ConstraintError);
      });

      then('the message names the CONSTRUCTOR as the refuser', async () => {
        expect((await refusal).message).toContain(
          'a surf spot must carry a name',
        );
      });

      then('the whole surface a caller meets is snapped', async () => {
        expect((await refusal).message).toMatchSnapshot();
      });
    });

    when('[t1] the same body carries a real name', () => {
      // .why = the positive control. without it a green `[t0]` could equally mean "every body
      //        at this slot is refused", which would prove the refusal fires and prove naught
      //        about what DISCRIMINATES it
      then('it constructs, so the guard discriminates', async () => {
        const { bodyAfter } = await invokeMiddleware(schema, {
          spot: { name: 'pipeline' },
        });
        expect(bodyAfter.spot).toBeInstanceOf(GuardedSpot);
      });
    });
  });
});
