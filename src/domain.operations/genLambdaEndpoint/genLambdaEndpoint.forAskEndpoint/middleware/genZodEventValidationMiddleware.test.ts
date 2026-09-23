import { DomainEntity, DomainLiteral } from 'domain-objects';
import { ConstraintError, getError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { genZodEventValidationMiddleware } from './genZodEventValidationMiddleware';

/**
 * .what = two domain-objects used by the coerce cases below — a literal nested
 *         inside an entity, exactly as `Job`/`Address` sit in the codegen fixtures
 * .why = the wish's headline acceptance is that a validated input arrives as a REAL
 *        domain instance, at every depth, with no `as` cast and no hand-rebuild. that
 *        claim is about `domain-objects@0.34.0`'s coerce, so it owes a run rather than
 *        a read (rule.require.measure-the-value-you-emit)
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
    home: SurfSpot.contract(), // <-- the inner dobj declares its OWN contract
  });
}

/**
 * .what = a dobj whose CONSTRUCTOR demands more than its schema does
 * .why = the wish asks that a dobj which fails its construction-time validation fails
 *        loud at the boundary. that is a check the schema cannot stand in for: the
 *        coerce runs `X.build(props, { skip: { schema: true } })`, so the schema is
 *        deliberately NOT re-run at construct time and the two can genuinely disagree
 *        (`domain-objects/dist/manipulation/getContract.js:132,150`)
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

/**
 * .what = a dobj that names `nested` while its schema declares the inner shape as a
 *         PLAIN object — the only configuration in which `.nested` can be shown to be
 *         the mechanism at work
 * .why = `Surfer` above carries BOTH routes at once (a `nested` entry AND an inner
 *        `.contract()`), so it cannot tell them apart. measured: drop `Surfer.nested`
 *        and its `home` is a `SurfSpot` all the same — the SCHEMA WALK is what drives
 *        that one. this dobj isolates the other route
 */
interface WaveReport {
  spotName: string;
  spot: SurfSpot;
}
class WaveReport extends DomainEntity<WaveReport> implements WaveReport {
  public static primary = ['spotName'] as const;
  public static nested = { spot: SurfSpot };
  public static schema = z.object({
    spotName: z.string(),
    spot: z.object({ name: z.string(), breakType: z.string() }), // <-- PLAIN
  });
}

describe('genZodEventValidationMiddleware', () => {
  /**
   * .note = the return is declared `T`, the schema's own post-parse shape, so a case
   *         can read `inputAfter` without a cast of its own. every cast lives HERE
   *         (rule.require.named-transformers — one place holds the friction, never every
   *         call site)
   *
   * .as = FOUR casts, and each has its own reason + removal path (rule.forbid.as-cast):
   *       1. `context` — middy's `Context` is the aws lambda context, which no case reads
   *       2. `error` — middy's `Request.error` is `Error | null` before a hook throws
   *       3. the request literal — middy's `MiddlewareFn` parameter carries fields a test
   *          never supplies. 1-3 drop together if middy ever ships a request builder
   *       4. `request.event as T` — middy types `event` as `any`, so the post-parse shape
   *          has to be re-stated. drops once the chain carries `inputAfter` in its own
   *          slot rather than back in the event's place — the 🚧 F31 fulcrum
   *
   * ⚠️ .note = this block read "the one cast lives here" until review `r6.role-standards`
   *            counted them. a comment that miscounts its own file is the same defect class
   *            as a stale version in a doc block — checkable, and unchecked
   */
  const invokeMiddleware = async <T>(
    schema: z.ZodSchema<T>,
    event: unknown,
  ): Promise<T> => {
    const middleware = genZodEventValidationMiddleware({ schema });
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);
    return request.event as T;
  };

  given('[case1] valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    when('[t0] validated', () => {
      then('it should pass validation', async () => {
        const result = await invokeMiddleware(schema, {
          name: 'alice',
          age: 30,
        });
        expect(result).toEqual({ name: 'alice', age: 30 });
      });
    });
  });

  given('[case2] invalid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    when('[t0] validated', () => {
      // .why ONE invocation, shared = the two rows below grade ONE refusal, so they must
      //      read ONE run (rule.forbid.redundant-expensive-operations). this pair predates
      //      the branch; it is repaired here because it shares the exact shape the branch's
      //      own trios had, and the file was already open (rule.prefer.scouts-honor)
      const refusal = getError(
        invokeMiddleware(schema, { name: 123, age: 'invalid' }),
      );

      then('it should throw ConstraintError', async () => {
        expect(await refusal).toBeInstanceOf(ConstraintError);
      });

      then('error message should contain validation failed', async () => {
        expect((await refusal).message).toContain('validation failed');
      });
    });
  });

  given('[case3] schema with default values', () => {
    const schema = z.object({
      name: z.string(),
      enabled: z.boolean().default(true),
    });

    when('[t0] validated without optional field', () => {
      then('it should apply default value', async () => {
        const result = await invokeMiddleware(schema, { name: 'alice' });
        expect(result).toEqual({ name: 'alice', enabled: true });
      });
    });
  });

  given('[case4] schema with transform', () => {
    const schema = z.object({
      email: z.string().transform((val) => val.toLowerCase()),
    });

    when('[t0] validated', () => {
      then('it should apply transform', async () => {
        const result = await invokeMiddleware(schema, {
          email: 'ALICE@Example.COM',
        });
        expect(result).toEqual({ email: 'alice@example.com' });
      });
    });
  });

  given('[case5] partially valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    when('[t0] validated with mixed valid/invalid fields', () => {
      then('it should throw ConstraintError', async () => {
        const error = await getError(
          invokeMiddleware(schema, {
            name: 'alice',
            age: 'not a number',
            email: 'invalid',
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // the wish's headline acceptance, clamped: a validated input arrives as a real
  // domain instance at every depth the vision's uc.1-uc.4 name. before these cases
  // the only proof of that was PROSE — `grepsafe --pattern 'instanceof (Surfer|...)'`
  // returned 24 hits and every one sat in a `.md`
  //
  // ⚠️ .note = that zero over `.ts` is a NEGATIVE, so it is worth only as much as the
  //            form that produced it. the control, re-run: the same tool under the same
  //            `--path src --glob '*.ts'` bound returns hits for the bare word
  //            `instanceof` across `genApiGatewayProxyHarness.ts`,
  //            `createInProcessLambdaHarness.ts`, and the roundtrip integration spec —
  //            so the scope is reachable and the zero was an absence rather than a
  //            glob artifact. ⇒ what the alternation could still have missed is an
  //            `instanceof` against a dobj named outside it; the bare form above closes
  //            that, since it constrains no class name at all
  //            (rule.require.positive-control-before-absence-claims)
  // ---------------------------------------------------------------------------

  given('[case6] a dobj at the TOP LEVEL of the schema (vision uc.1)', () => {
    const schema = z.object({ surfer: Surfer.contract() });
    const wire = {
      surfer: {
        uuid: 'u1',
        handle: 'crush',
        home: { name: 'pipeline', breakType: 'reef' },
      },
    };

    when('[t0] validated', () => {
      // .why ONE invocation, shared = the two rows grade ONE coerce, at two depths
      //      (rule.forbid.redundant-expensive-operations)
      const result = useThen('it resolves', async () =>
        invokeMiddleware(schema, wire),
      );

      then('the field arrives as a real Surfer instance', () => {
        expect(result.surfer).toBeInstanceOf(Surfer);
      });

      then('its NESTED dobj arrives as a real SurfSpot too', () => {
        expect(result.surfer.home).toBeInstanceOf(SurfSpot);
      });
    });
  });

  given('[case7] a dobj under a PLAIN wrapper (vision uc.2)', () => {
    // .why = this is the shape the WISH's own evidence has — a nullable plain
    //        `assignment` wrapper with the dobj one level beneath it. a top-level-only
    //        coerce would leave exactly this case hand-rolled
    const schema = z.object({
      signup: z
        .object({ surfer: Surfer.contract(), note: z.string() })
        .nullable(),
    });

    const wire = {
      signup: {
        surfer: {
          uuid: 'u1',
          handle: 'crush',
          home: { name: 'pipeline', breakType: 'reef' },
        },
        note: 'first lesson',
      },
    };

    when('[t0] validated with the wrapper present', () => {
      // .why ONE invocation, shared = the two rows grade ONE coerce — the dobj beneath the
      //      wrapper, and its plain peer (rule.forbid.redundant-expensive-operations)
      const result = useThen('it resolves', async () =>
        invokeMiddleware(schema, wire),
      );

      then('the dobj beneath the wrapper is a real instance', () => {
        expect(result.signup?.surfer).toBeInstanceOf(Surfer);
      });

      then('a plain peer field beside it stays plain', () => {
        expect(result.signup?.note).toEqual('first lesson');
      });
    });

    when('[t1] validated with the wrapper null', () => {
      then('the null passes through untouched', async () => {
        const result = await invokeMiddleware(schema, { signup: null });
        expect(result.signup).toEqual(null);
      });
    });
  });

  given('[case8] a dobj inside an ARRAY (vision uc.3)', () => {
    const schema = z.object({ surfers: z.array(Surfer.contract()) });

    when('[t0] validated', () => {
      then('every element arrives as a real instance', async () => {
        const result = await invokeMiddleware(schema, {
          surfers: [
            {
              uuid: 'u1',
              handle: 'crush',
              home: { name: 'pipeline', breakType: 'reef' },
            },
            {
              uuid: 'u2',
              handle: 'squirt',
              home: { name: 'trestles', breakType: 'point' },
            },
          ],
        });
        expect(result.surfers).toHaveLength(2);
        expect(result.surfers.every((s) => s instanceof Surfer)).toEqual(true);
      });
    });
  });

  given('[case9] a dobj whose wire is rejected', () => {
    // .why = the wish asks that a dobj which fails its construction-time validation
    //        FAILS LOUD at the boundary and never reaches `handle` half-built
    //        (rule.require.failfast)
    //
    // .note = this case rejects at the SCHEMA. the constructor is the other half of the
    //         wish's concern, and it is a genuinely separate check — see [case11]
    const schema = z.object({ surfer: Surfer.contract() });

    when('[t0] validated with a field of the wrong type', () => {
      then(
        'it throws a ConstraintError, never a half-built instance',
        async () => {
          const error = await getError(
            invokeMiddleware(schema, {
              surfer: { uuid: 7, handle: 'crush', home: null },
            }),
          );
          expect(error).toBeInstanceOf(ConstraintError);
        },
      );
    });
  });

  given('[case10] a dobj nested by `.nested` ALONE (vision uc.4)', () => {
    // .why = `WaveReport.schema` declares its inner spot as a PLAIN object, so the
    //        schema walk has no contract to follow there. a `SurfSpot` at that
    //        position can only come from the `.nested` entry, which makes this the
    //        one case that proves uc.4's stated mechanism rather than a peer of it
    const schema = z.object({ report: WaveReport.contract() });
    const wire = {
      report: {
        spotName: 'pipeline',
        spot: { name: 'pipeline', breakType: 'reef' },
      },
    };

    when('[t0] validated', () => {
      // .why ONE invocation, shared = the two rows grade ONE coerce — the outer dobj, and
      //      the inner one `.nested` rebuilt (rule.forbid.redundant-expensive-operations)
      const result = useThen('it resolves', async () =>
        invokeMiddleware(schema, wire),
      );

      then('the outer dobj is a real instance', () => {
        expect(result.report).toBeInstanceOf(WaveReport);
      });

      then('the inner field is a real SurfSpot, via `.nested`', () => {
        expect(result.report.spot).toBeInstanceOf(SurfSpot);
      });
    });
  });

  given(
    '[case11] a wire the SCHEMA accepts and the CONSTRUCTOR rejects',
    () => {
      // .why = the half of the wish's fail-loud ask that [case9] cannot reach. the coerce
      //        builds with `{ skip: { schema: true } }`, so a constructor demand the schema
      //        does not encode is the only guard left between a bad wire and `handle`
      const schema = z.object({ spot: GuardedSpot.contract() });

      when('[t0] the wire passes the schema', () => {
        /**
         * ⚠️ .why ONE invocation, shared = the three rows below grade ONE refusal, so they
         *         must read ONE run. three separate calls read as one verdict while they are
         *         three (rule.forbid.redundant-expensive-operations)
         *
         * ⚠️ .why a shared PROMISE rather than `useThen` = measured, after `useThen` went red
         *         here. its proxy DELETES its own `get` trap once the registered test
         *         completes (`useThen.js:36`), and thereafter serves a `drawer` built by
         *         `Object.assign` (`:34`) — which copies OWN ENUMERABLE props only. so for an
         *         ERROR it carries neither half of what these rows assert:
         *           — `message` is a non-enumerable own prop, so it is never copied  -> undefined
         *           — the drawer is a plain `{}`, so `toBeInstanceOf` reads `Object`
         *         ⇒ `useThen` fits a plain DATA result (`[case6]`/`[case7]`/`[case10]` use it
         *           and pass); it does not fit an error, nor any identity assertion
         *
         * .note = a promise awaited N times still runs its executor ONCE, so this keeps the
         *         one-run guarantee. `getError` settles the rejection at creation, so no
         *         unhandled-rejection warn fires while the rows queue
         */
        const refusal = getError(
          invokeMiddleware(schema, { spot: { name: '   ' } }),
        );

        then('it is still refused, as a ConstraintError', async () => {
          expect(await refusal).toBeInstanceOf(ConstraintError);
        });

        then('the message names the constructor as the refuser', async () => {
          expect((await refusal).message).toContain(
            'a surf spot must carry a name',
          );
        });

        // .why = the two assertions above pin two substrings, so every word AROUND
        //        them can drift with the suite still green. the wish's ask is that a
        //        bad wire "fails loud at the boundary" — what a handler author meets
        //        is the WHOLE string, so the whole string is what a reviewer must be
        //        able to vibecheck (rule.require.snapshots)
        //
        // .note = the snapshot is of `.message` rather than the error object, because
        //         helpful-errors serializes its metadata INTO the message — so this
        //         one value already carries both halves of the surface
        then(
          'the whole surface a handler author meets is snapped',
          async () => {
            expect((await refusal).message).toMatchSnapshot();
          },
        );
      });

      when('[t1] the same wire carries a real name', () => {
        then('it constructs, so the guard discriminates', async () => {
          const result = await invokeMiddleware(schema, {
            spot: { name: 'pipeline' },
          });
          expect(result.spot).toBeInstanceOf(GuardedSpot);
        });
      });
    },
  );

  given(
    '[case12] the dobj POSITION ITSELF is nullable or optional (the wish evidence, generalized)',
    () => {
      /**
       * .what = `.nullable()` / `.optional()` applied DIRECTLY to the dobj position,
       *         rather than to a plain wrapper above it
       *
       * ⚠️ .why this was a real gap, and why `[case7]` did not already cover it = every
       *    other coerce case declares its dobj field REQUIRED, and `[case7]`'s
       *    `.nullable()` sits on the PLAIN `signup` wrapper — the dobj one level beneath
       *    it stays required. so the absent-dobj shape had never run
       *
       * .why it is the shape that matters most = it is the wish's OWN seed evidence,
       *      generalized one step. `configureProxyPhoneNumber` carries
       *      `assignment.agent: Agent | null`, and a consumer reaches for exactly this
       *      the moment a domain object is a field that may legitimately be absent
       *
       * ⚠️ .the adjacent FOOTGUN, read from the dependency rather than guessed = a zod
       *    chain op returns a FRESH schema that carries no `.ref`, so
       *    `X.contract().optional().ref('primary')` fails — a `TypeError` in js, a
       *    compile error in ts. the order that works is ref-FIRST, then chain
       *    (`domain-objects/dist/manipulation/getContract.d.ts:36-39`). this file clamps
       *    the plain-coerce half; the ref-after-chain half is upstream's own documented
       *    contract and is not re-proven here (rule.prefer.wet-over-dry)
       *
       * ⚠️ .PROVEN BY REVERT, since a clamp nobody has seen fail is a guess
       *    (rule.require.clamp-edge-cases). drop the `.nullable()` from `surfer` below:
       *
       *      revert                              | result
       *      ------------------------------------|--------------------------------------
       *      `.nullable()` -> bare `.contract()`  | 🔴 exactly 1 red, and it is `[t1]`
       *
       *    ⇒ the count is the useful half. ONE row moved, so `[t1]` genuinely exercises
       *      the nullable wrapper, and the other rows do not lean on it to pass
       */
      const schema = z.object({
        surfer: Surfer.contract().nullable(),
        coach: Surfer.contract().optional(),
      });

      const surferWire = {
        uuid: 'u1',
        handle: 'crush',
        home: { name: 'pipeline', breakType: 'reef' },
      };

      when('[t0] both positions carry a real dobj', () => {
        // .why ONE invocation, shared = the two rows grade ONE coerce, at two positions
        //      (rule.forbid.redundant-expensive-operations)
        const result = useThen('it resolves', async () =>
          invokeMiddleware(schema, {
            surfer: surferWire,
            coach: surferWire,
          }),
        );

        then('the NULLABLE position hydrates', () => {
          expect(result.surfer).toBeInstanceOf(Surfer);
        });

        then('the OPTIONAL position hydrates too', () => {
          expect(result.coach).toBeInstanceOf(Surfer);
        });
      });

      when('[t1] the nullable position is explicitly null', () => {
        then(
          'the null passes through, rather than into the constructor',
          async () => {
            // ⚠️ this is the row the gap was about. `X.contract()` coerces through the
            //    class constructor, so the open question was whether a `null` short-circuits
            //    at the zod wrapper or falls INTO `new Surfer(null)` and throws a fault a
            //    consumer cannot read. measured: it short-circuits
            const result = await invokeMiddleware(schema, {
              surfer: null,
              coach: surferWire,
            });
            expect(result.surfer).toEqual(null);
          },
        );
      });

      when('[t2] the optional position is absent from the wire', () => {
        // .why ONE invocation, shared = both rows grade ONE parse of one wire
        const result = useThen('it resolves', async () =>
          invokeMiddleware(schema, { surfer: surferWire }),
        );

        then('the absent key stays undefined', () => {
          expect(result.coach).toEqual(undefined);
        });

        then('and its REQUIRED-shaped peer still hydrates beside it', () => {
          // .why = a positive control. without it, a coerce that silently no-ops for the
          //        whole object would satisfy the row above and read as a pass
          expect(result.surfer).toBeInstanceOf(Surfer);
        });
      });
    },
  );
});
