import { DomainEntity, DomainLiteral } from 'domain-objects';
import { ConstraintError, getError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { ApiGatewayRequestEventUnified } from '../ApiGatewayRequestEventUnified';
import { genZodInputValidationMiddleware } from './genZodInputValidationMiddleware';

/**
 * .what = a direct unit suite for the middleware that validates the pair and writes it BACK
 * .why = the two write-back rules are ASYMMETRIC on purpose — headers MERGE, payload REPLACE —
 *        and that split is the linchpin of the projection invariant (`headers === event.headers`,
 *        `payload === event.payload`). until this file, both rules were proven only end-to-end
 *        through `forApiGateway.test.ts`, where a chain of 12 entries sits between the cause and
 *        the observation
 *
 * .why a direct suite EARNS its place, rather than duplicate the chain tests = the merge rule has
 *        an arm the chain cannot reach cheaply. an author who declares ONE header key makes zod
 *        strip every other, and the values stripped belong to VENDORS — `origin` for
 *        `@middy/http-cors`, `accept` for `@middy/http-response-serializer`. to prove survival of
 *        a key no test handler ever reads, the chain must configure the vendor that reads it; here
 *        the assertion is one line (`rule.require.read-the-slot-a-dependency-reads`)
 *
 * .note = every other transformer this route introduced carries its own unit file
 *         (`asHeaderKeysLowercased`, `setEventFrozen`, `asApiGatewayRequestEventUnified`,
 *         `asApiGatewayRequestEventOnwire`). this one did not, and it is the only one that MUTATES
 */
/**
 * .what = a literal nested in an entity, plus a dobj whose CONSTRUCTOR demands more than its
 *         schema — the same fixtures the forAsk validator test declares
 * .why = `getValidatedInput` is ONE primitive that every family reaches, so its coerce owes a
 *        clamp at this slot too. the fixtures match the twin's, so a divergence in result is
 *        attributable to the slot alone (rule.require.sweep-the-defect-class)
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
 * .note = the coerce runs `X.build(props, { skip: { schema: true } })`, so the schema is NOT
 *         re-run at construct time and the two can disagree — which is what `[case8]` needs
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

describe('genZodInputValidationMiddleware', () => {
  /**
   * .what = the minimal envelope this middleware reads and writes
   * .why = it reads exactly two slots and writes exactly two, so the fixture declares exactly
   *        those plus the vendor keys the merge must preserve. a fuller event would obscure which
   *        fields carry the load here
   */
  const asEvent = (input: {
    headers: Record<string, string | undefined>;
    payload: unknown;
  }): ApiGatewayRequestEventUnified =>
    ({
      headers: input.headers,
      payload: input.payload,
    }) as unknown as ApiGatewayRequestEventUnified;

  const asRequest = (event: ApiGatewayRequestEventUnified) =>
    ({ event }) as unknown as Parameters<
      ReturnType<typeof genZodInputValidationMiddleware>['before']
    >[0];

  given(
    '[case1] a schema that declares ONE header key, beside others on the wire',
    () => {
      const schema = z.object({
        headers: z.object({ authorization: z.string() }),
        payload: z.object({ name: z.string() }),
      });

      /**
       * .what = the MERGE rule, at its own grain
       * .why = zod strips unknown keys, so `result.data.headers` holds `authorization` ALONE.
       *        a wholesale replace would delete `origin` and `accept` from the slot two vendors
       *        read in their `after` hooks — after the handler has returned, where no error
       *        surfaces (`genZodInputValidationMiddleware.ts:71-88`)
       */
      when('[t0] the middleware runs', () => {
        const event = useThen('it writes back', async () => {
          const subject = asEvent({
            headers: {
              authorization: 'Bearer tok',
              origin: 'https://b.test',
              accept: 'application/xml',
            },
            payload: { name: 'Kai' },
          });

          await genZodInputValidationMiddleware({ schema }).before(
            asRequest(subject),
          );
          return subject;
        });

        then('the declared key survives, validated', () => {
          expect(event.headers.authorization).toBe('Bearer tok');
        });

        then(
          'the undeclared vendor keys survive too — zod stripped them',
          () => {
            // `@middy/http-cors` reads this slot's `origin` (index.js:84). a replace deletes
            // it, and cors then answers `origins[0]` to a caller from `origins[1]`
            // (index.js:2-14)
            expect(event.headers.origin).toBe('https://b.test');

            // `@middy/http-response-serializer` reads `accept` (index.js:25)
            expect(event.headers.accept).toBe('application/xml');
          },
        );

        then('the payload is REPLACED by the validated value', () => {
          expect(event.payload).toEqual({ name: 'Kai' });
        });
      });
    },
  );

  /**
   * .what = the ABSENT-key arm of the merge, which needs no branch
   * .why = an author who declares no `headers` gets `result.data.headers === undefined`, and a
   *        spread of `undefined` is a no-op. so ONE rule serves both cases — and a reader who
   *        doubts that is exactly who this case is for (`rule.avoid.unnecessary-ifs`)
   */
  given('[case2] a schema that declares NO header key at all', () => {
    const schema = z.object({ payload: z.object({ name: z.string() }) });

    when('[t0] the middleware runs', () => {
      const event = useThen('it writes back', async () => {
        const subject = asEvent({
          headers: { origin: 'https://b.test', accept: 'application/json' },
          payload: { name: 'Kai' },
        });

        await genZodInputValidationMiddleware({ schema }).before(
          asRequest(subject),
        );
        return subject;
      });

      then(
        'every wire header survives untouched — enforcement is OPT-IN',
        () => {
          expect(event.headers).toEqual({
            origin: 'https://b.test',
            accept: 'application/json',
          });
        },
      );

      then('the payload is still validated and written back', () => {
        expect(event.payload).toEqual({ name: 'Kai' });
      });
    });
  });

  /**
   * .what = the REFUSAL, at its own grain — the peer of `forApiGateway.test.ts [case18][t1]`
   * .why = that case proves the refusal reaches the WIRE as a 400. this one proves the middleware
   *        THROWS, which is a different claim: a chain could swallow a throw and still answer 400
   *        for an unrelated reason
   */
  given('[case3] a request that violates the declared header schema', () => {
    const schema = z.object({
      headers: z.object({ authorization: z.string() }),
      payload: z.object({ name: z.string() }),
    });

    when('[t0] the declared header is absent', () => {
      then('the middleware THROWS, and it names the header path', async () => {
        const subject = asEvent({
          headers: { origin: 'https://b.test' },
          payload: { name: 'Kai' },
        });

        await expect(
          genZodInputValidationMiddleware({ schema }).before(
            asRequest(subject),
          ),
        ).rejects.toThrow(/headers\.authorization/);
      });
    });

    when('[t1] the payload is the half at fault', () => {
      then('the middleware THROWS, and it names the payload path', async () => {
        const subject = asEvent({
          headers: { authorization: 'Bearer tok' },
          payload: { name: 42 },
        });

        await expect(
          genZodInputValidationMiddleware({ schema }).before(
            asRequest(subject),
          ),
        ).rejects.toThrow(/payload\.name/);
      });
    });

    /**
     * .what = the POSITIVE CONTROL for both arms above
     * .why = a `rejects.toThrow` pair proves the middleware refuses two shapes. it does NOT
     *        prove the middleware ever ACCEPTS one — a step that threw unconditionally would
     *        satisfy both (`rule.require.positive-control-before-absence-claims`)
     */
    when('[t2] both halves are valid', () => {
      then('the middleware accepts, and writes back', async () => {
        const subject = asEvent({
          headers: { authorization: 'Bearer tok' },
          payload: { name: 'Kai' },
        });

        await expect(
          genZodInputValidationMiddleware({ schema }).before(
            asRequest(subject),
          ),
        ).resolves.toBeUndefined();

        expect(subject.payload).toEqual({ name: 'Kai' });
      });
    });
  });

  /**
   * .what = the write-back that the PROJECTION invariant rests on
   * .why = the handler's bag and the envelope are ONE object each, and that holds only while
   *        this step writes the validated values INTO the envelope. a write into a side bag
   *        would satisfy every `rejects`/`resolves` assertion above and leave the envelope
   *        stale — the failure `domain.terms/headers.md` calls silent
   */
  given('[case4] the envelope after the write-back', () => {
    const schema = z.object({
      headers: z.object({ authorization: z.string() }),
      payload: z.object({ name: z.string() }),
    });

    when('[t0] a reader takes the envelope path to each value', () => {
      const event = useThen('it writes back', async () => {
        const subject = asEvent({
          headers: { authorization: 'Bearer tok', origin: 'https://b.test' },
          payload: { name: 'Kai' },
        });

        await genZodInputValidationMiddleware({ schema }).before(
          asRequest(subject),
        );
        return subject;
      });

      then(
        'the envelope carries the VALIDATED values, not the wire ones',
        () => {
          // this is what deleted the `event.body as TInput` cast at the invoke hand-off (F13)
          expect(event.payload).toEqual({ name: 'Kai' });
          expect(event.headers.authorization).toBe('Bearer tok');
        },
      );
    });
  });

  /**
   * .what = runs the middleware on a payload alone, and hands back the payload it wrote
   * .note = a plain promise, never `useThen`, wherever a row reads a prototype or an error:
   *         `useThen`'s proxy serves an own-enumerable copy once its test completes, which drops
   *         both the prototype `toBeInstanceOf` reads and an error's `message`
   */
  const asPayloadValidated = async <T>(input: {
    schema: z.ZodSchema<{ payload: T }>;
    payload: unknown;
  }): Promise<T> => {
    const subject = asEvent({ headers: {}, payload: input.payload });
    await genZodInputValidationMiddleware({ schema: input.schema }).before(
      asRequest(subject),
    );
    return subject.payload as T;
  };

  given('[case5] a dobj in the payload', () => {
    const schema = z.object({
      payload: z.object({ surfer: Surfer.contract() }),
    });

    when('[t0] validated', () => {
      const validated = asPayloadValidated({
        schema,
        payload: {
          surfer: {
            uuid: 'u1',
            handle: 'crush',
            home: { name: 'pipeline', breakType: 'reef' },
          },
        },
      });

      then('the field arrives as a real Surfer instance', async () => {
        expect((await validated).surfer).toBeInstanceOf(Surfer);
      });

      then('its NESTED dobj arrives as a real SurfSpot too', async () => {
        expect((await validated).surfer.home).toBeInstanceOf(SurfSpot);
      });
    });
  });

  /**
   * .what = the two shapes `deserialize: { payload: false }` can leave in the slot — a raw STRING,
   *         and NULL (aws types the wire body `string | null`, and a GET with no body is null on
   *         the default path too)
   * .why = the coerce then meets a non-object, and must refuse it as a caller fault, never crash
   */
  given('[case6] a raw STRING payload', () => {
    const schema = z.object({
      payload: z.object({ surfer: Surfer.contract() }),
    });

    when('[t0] the coerce meets a string rather than an object', () => {
      const refusal = getError(
        asPayloadValidated({ schema, payload: '{"surfer":{"uuid":"u1"}}' }),
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
  });

  given('[case7] a NULL payload', () => {
    const schema = z.object({
      payload: z.object({ surfer: Surfer.contract() }),
    });

    when('[t0] the coerce meets null rather than an object', () => {
      const refusal = getError(asPayloadValidated({ schema, payload: null }));

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

  /**
   * .what = a payload the SCHEMA accepts and the CONSTRUCTOR rejects fails loud at this slot
   * .note = it stops at the `ConstraintError`; the 400 it becomes is clamped at the endpoint grain
   * ⚠️ .to prove it bites = strike the constructor's `throw`: `[t0]` goes red, `[t1]` stays green
   *    (rule.require.clamp-edge-cases)
   */
  given(
    '[case8] a payload the schema accepts and the constructor rejects',
    () => {
      const schema = z.object({
        payload: z.object({ spot: GuardedSpot.contract() }),
      });

      when('[t0] the payload passes the schema', () => {
        const refusal = getError(
          asPayloadValidated({ schema, payload: { spot: { name: '   ' } } }),
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

      when('[t1] the same payload carries a real name', () => {
        // the positive control: proves the guard discriminates, rather than refuses every payload
        then('it constructs', async () => {
          const payload = await asPayloadValidated({
            schema,
            payload: { spot: { name: 'pipeline' } },
          });
          expect(payload.spot).toBeInstanceOf(GuardedSpot);
        });
      });
    },
  );
});
