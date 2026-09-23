import { DomainEntity } from 'domain-objects';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { getJsonSchemaFromZod } from './genIntrospectionMiddleware.getJsonSchemaFromZod';
import { getValidatedOutput } from './getValidatedOutput';

/**
 * .what = the thrown error, as a shape a snapshot can carry
 * .why = `.toThrow()` alone proves only that SOMETHING threw, which a cast or an early
 *        guard would satisfy just as well as zod's own dispatch. the name and the message
 *        are what say WHICH mechanism refused, so a later zod upgrade that moves the
 *        refusal elsewhere goes red rather than stays quietly green
 *        (rule.require.clamp-edge-cases)
 *
 * .note = it sits at module scope because TWO cases read it, and each reads it for the
 *         SAME reason — `[case8]` asks which mechanism refused a FOREIGN schema, and
 *         `[case10]` asks which mechanism refused a NATIVE one. the pair is the whole
 *         positive control, so they must grade by one instrument
 */
const asThrownShape = (
  act: () => unknown,
): { name: string; message: string } => {
  try {
    act();
  } catch (thrown) {
    const error = thrown as Error;
    return { name: error.constructor.name, message: error.message };
  }
  throw new Error('expected a throw, and the act returned');
};

describe('getJsonSchemaFromZod', () => {
  given('[case1] simple object schema', () => {
    const schema = z.object({
      id: z.string(),
      name: z.string(),
    });

    when('[t0] converted', () => {
      then('returns JSON schema with properties', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.type).toBe('object');
        expect(result.properties).toBeDefined();
        expect((result.properties as Record<string, unknown>).id).toBeDefined();
        expect(
          (result.properties as Record<string, unknown>).name,
        ).toBeDefined();
      });
    });
  });

  given('[case2] schema with optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    when('[t0] converted', () => {
      then('marks required fields correctly', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.required).toContain('required');
        expect(result.required).not.toContain('optional');
      });
    });
  });

  given('[case3] schema with union types', () => {
    const schema = z.union([z.string(), z.number()]);

    when('[t0] converted', () => {
      then('returns anyOf structure', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.anyOf).toBeDefined();
      });
    });
  });

  given('[case4] nested object schema', () => {
    const schema = z.object({
      user: z.object({
        email: z.string(),
      }),
    });

    when('[t0] converted', () => {
      then('preserves nested structure', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.type).toBe('object');
        expect(result.properties).toBeDefined();
        const userProp = (result.properties as Record<string, unknown>)
          .user as Record<string, unknown>;
        expect(userProp.type).toBe('object');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // the OUTPUT border. the subject publishes `{ io: 'input' }` UNCONDITIONALLY, and
  // that is a claim about a document THIS CODE EMITS — so it owes a run, never a read
  // (rule.require.measure-the-value-you-emit). each row below drives a real return
  // through `getValidatedOutput` (the one output-side validator both families reach),
  // serializes it as the lambda runtime does, and pins the DOCUMENT beside the FACE.
  //
  // ⚠️ .defect = LIVE, NOT FIXED — two rows publish a face that CONTRADICTS the
  //              document it claims to describe
  //   .proof it is live = the `.pipe()` and type-shift `.transform()` rows declare
  //                       `verdict: 'CONTRADICTS'`, and that verdict is COMPUTED from
  //                       the measured pair rather than stated by hand. those rows
  //                       are GREEN, so the defect is present; each goes RED the day
  //                       the published face and the emitted document reconcile
  //   .why unrepaired = the only face that describes those two rows is `io: 'output'`,
  //                     and `[case6]` below measures that it THROWS for every
  //                     `X.contract()` position — the crash this change exists to
  //                     retire. a per-schema choice between the two faces is two code
  //                     paths for one guarantee (rule.forbid.parallel-codepaths) plus
  //                     a silent fallback (rule.forbid.failhide), so one face serves
  //                     both borders and the divergence is DECLARED, never hidden
  //   .the trade, BOTH halves measured = `[case6]` drives the discarded face at a dobj
  //                     and clamps the throw; `[case7]` drives it at the `.pipe()` and
  //                     clamps that it does NOT throw and publishes `number`. so the
  //                     cost of this choice is a run rather than a sentence
  //   .bound = the headline shape is the dobj row, and it AGREES — a coerced instance
  //            serializes to the exact document its `io: 'input'` face declares
  // ---------------------------------------------------------------------------
  interface Surfer {
    uuid: string;
    name: string;
  }
  class Surfer extends DomainEntity<Surfer> implements Surfer {
    public static primary = ['uuid'] as const;
    public static schema = z.object({ uuid: z.string(), name: z.string() });
  }

  interface JsonFace {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  }

  /**
   * .what = grades the published face against the document that actually crossed
   * .why = the verdict must be MEASURED from the pair, else the table states a claim
   *        about itself and a drift in either half leaves it green
   */
  const getFaceVerdict = (input: {
    wire: Record<string, unknown>;
    face: JsonFace;
    of: string;
  }): 'agrees' | 'under-declares' | 'CONTRADICTS' => {
    const property = (input.face.properties ?? {})[input.of] ?? {};
    const present = input.of in input.wire;
    const required = (input.face.required ?? []).includes(input.of);
    if (
      present &&
      property.type &&
      typeof input.wire[input.of] !== property.type
    )
      return 'CONTRADICTS';
    if (present && !required) return 'under-declares';
    return 'agrees';
  };

  interface CaseBorder {
    description: string;
    schema: z.ZodType;
    returned: unknown;
    of: string;
    expect: {
      wire: Record<string, unknown>;
      verdict: 'agrees' | 'under-declares' | 'CONTRADICTS';
    };
  }

  /**
   * .what = the one schema on which the discarded face was CORRECT
   * .why = the trade this change declares has two halves, and both are measured against
   *        THIS value — `[case5]`'s row drives it through the shipped face, `[case7]`
   *        drives it through the discarded one. one const, so a drift in the schema
   *        cannot leave one half green while the other moves
   */
  const SCHEMA_PIPE = z.object({ n: z.string().pipe(z.coerce.number()) });

  const CASES_BORDER: CaseBorder[] = [
    {
      // .why = THE HEADLINE. `X.contract()` always coerces, so this is the shape every
      //        dobj endpoint takes at its output border. the face must describe the
      //        document a caller receives, and here it does — exactly
      description:
        'a coerced domain object, the shape this change exists to serve',
      schema: z.object({ surfer: Surfer.contract() }),
      returned: { surfer: new Surfer({ uuid: 'u1', name: 'crush' }) },
      of: 'surfer',
      expect: {
        wire: { surfer: { uuid: 'u1', name: 'crush' } },
        verdict: 'agrees',
      },
    },
    {
      // .why = the positive control. a schema with no transform anywhere has ONE face,
      //        so a divergence here would mean the harness itself is wrong
      description: 'a plain shape, where the two faces are one',
      schema: z.object({ name: z.string(), limit: z.number() }),
      returned: { name: 'crush', limit: 3 },
      of: 'limit',
      expect: { wire: { name: 'crush', limit: 3 }, verdict: 'agrees' },
    },
    {
      description: 'a `.default()`, which the parse FILLS on the way out',
      schema: z.object({ name: z.string(), limit: z.number().default(10) }),
      returned: { name: 'crush' },
      of: 'limit',
      expect: { wire: { name: 'crush', limit: 10 }, verdict: 'under-declares' },
    },
    {
      description:
        'a `.catch()`, which REPLACES a rejected value on the way out',
      schema: z.object({ name: z.string(), limit: z.number().catch(7) }),
      returned: { name: 'crush', limit: 'nope' },
      of: 'limit',
      expect: { wire: { name: 'crush', limit: 7 }, verdict: 'under-declares' },
    },
    {
      // .why = the face says `string` and a NUMBER crosses. a weaker face is tolerable;
      //        this one states a type the document does not carry
      description:
        'a `.transform()` that SHIFTS the type — the face states the wrong one',
      schema: z.object({ handle: z.string().transform((raw) => raw.length) }),
      returned: { handle: 'crush' },
      of: 'handle',
      expect: { wire: { handle: 5 }, verdict: 'CONTRADICTS' },
    },
    {
      // .why = the SHARPEST row, and the one this change made worse. `io: 'output'`
      //        publishes `number` here and does NOT throw, so the prior default got
      //        this case right. it is traded for the dobj row above, which the prior
      //        default could not serve at all
      description:
        'a `.pipe()` — the one row where the discarded face was correct',
      schema: SCHEMA_PIPE,
      returned: { n: '42' },
      of: 'n',
      expect: { wire: { n: 42 }, verdict: 'CONTRADICTS' },
    },
  ];

  given(
    '[case5] a value on its way OUT, through the real output validator',
    () => {
      CASES_BORDER.map((thisCase) =>
        when(`[t0] ${thisCase.description}`, () => {
          const wire = JSON.parse(
            JSON.stringify(
              getValidatedOutput({
                response: thisCase.returned,
                schema: thisCase.schema,
              }),
            ),
          ) as Record<string, unknown>;
          const face = getJsonSchemaFromZod(thisCase.schema) as JsonFace;

          then(
            'the document that crosses is what the runtime serializes',
            () => {
              expect(wire).toEqual(thisCase.expect.wire);
            },
          );

          then('the published face grades as the row declares', () => {
            expect(getFaceVerdict({ wire, face, of: thisCase.of })).toEqual(
              thisCase.expect.verdict,
            );
          });
        }),
      );
    },
  );

  given(
    '[case6] the face this change DISCARDED, asked for the headline shape',
    () => {
      const schema = z.object({ surfer: Surfer.contract() });

      when('[t0] the discarded face is asked to render a coerced dobj', () => {
        // .why = this is the whole reason `io: 'input'` is unconditional. without this
        //        clamp the `[case5]` divergences read as an unforced choice
        then('it throws, so no per-border split was ever on the table', () => {
          expect(() => z.toJSONSchema(schema, { io: 'output' })).toThrow(
            'Transforms cannot be represented in JSON Schema',
          );
        });
      });
    },
  );

  given(
    '[case7] the face this change DISCARDED, asked for the shape it was RIGHT about',
    () => {
      // .why = `[case6]` measures one half of the declared trade: the discarded face THROWS
      //        for every dobj. this measures the other half — that it was CORRECT for the
      //        `.pipe()` row `[case5]` grades `CONTRADICTS`. both halves now rest on a run,
      //        so the `.defect` record states no claim the suite cannot settle
      //        (rule.require.measure-the-value-you-emit)
      when('[t0] the discarded face is asked to render a `.pipe()`', () => {
        then(
          'it does NOT throw — the crash is specific to the dobj shape',
          () => {
            expect(() =>
              z.toJSONSchema(SCHEMA_PIPE, { io: 'output' }),
            ).not.toThrow();
          },
        );

        then('it publishes `number`, the type the document carries', () => {
          const face = z.toJSONSchema(SCHEMA_PIPE, {
            io: 'output',
          }) as JsonFace;
          expect((face.properties ?? {}).n?.type).toEqual('number');
        });

        then('the SHIPPED face publishes `string` for the same schema', () => {
          // .why = the contradiction, stated as a pair rather than as prose. the two faces
          //        disagree on this one value, and `[case5]` measures that `number` is what
          //        actually crosses — so the shipped face is the wrong one HERE, and the
          //        dobj row is what it is traded for
          const face = getJsonSchemaFromZod(SCHEMA_PIPE) as JsonFace;
          expect((face.properties ?? {}).n?.type).toEqual('string');
        });
      });
    },
  );

  given(
    '[case8] a schema this zod install did NOT build — the two-copy hazard',
    () => {
      /**
       * ⚠️ .what = the GAP-PINNING clamp for `F03`, and it pins a gap rather than a repair
       * .why = `package.json` declares `zod` a plain `dependency` with no peer range, and this
       *        function does a VALUE import of `z` then hands it a schema object the CONSUMER's
       *        zod constructed. so a version split puts two copies in one `node_modules` and the
       *        publish path crosses between them — the one open item on this branch that had a
       *        measured hazard, a dream, a fulcrum, and NO clamp at all
       *
       * .why a clamp and not a fix = the repair is a peer range, and that is deferred as dirty
       *        (`F03`): it changes how every consumer's install picks a version, and the range's
       *        own WIDTH is the question. what is NOT dirty is to RECORD the failure mode, so
       *        the next traveler meets a measurement rather than a guess
       *        (rule.require.measure-the-value-you-emit)
       *
       * .why these three shapes = a foreign copy cannot be installed here, so the hazard is
       *        simulated at its mechanism instead. zod dispatches on `_zod.def`, so the three
       *        rows below are the three ways a foreign object can present that marker: absent
       *        entirely, present but hollow, and present with a `type` this copy cannot name
       *
       * ⚠️ .what this clamp WOULD catch = it goes red if a zod upgrade changes any of the three
       *        reactions — which is the exact drift `F03` is about. it does NOT prove a real
       *        two-copy install is safe, and no test in this repo can, since only one copy is
       *        installed. that bound is stated rather than left to imply more than it measures
       *
       * ⚠️ .the bite, MEASURED = disarm the subject's marker guard and this goes 🔴 **2** — `[t0]`
       *        and `[t1]` only. `[t2]` stays green, because there the marker is present and
       *        well-formed, so the guard passes it through to zod's OWN named refusal. ⇒ the
       *        count is the proof the guard is not over-broad: it fires on the two rows that had
       *        no diagnosis and on neither row that already had one (rule.require.clamp-edge-cases)
       *
       * .what the guard CHANGED, measured before and after = `[t0]` and `[t1]` raised a bare
       *        `TypeError` that named a property and not a cause, and now raise a
       *        `MalfunctionError` that names the split-install cause and the `npm ls zod` fix.
       *        the snapshots below carry the after half, so the improvement is a diff rather
       *        than a claim
       */
      const asForeignSchema = (shape: unknown): z.ZodType =>
        // .as = the whole point is a value this install's types refuse. a foreign copy's schema
        //       is structurally a `ZodType` to the consumer and an unknown object to us
        shape as z.ZodType;

      when('[t0] the marker is absent entirely', () => {
        then('it fails LOUD, and the refusal names its own mechanism', () => {
          expect(
            asThrownShape(() => getJsonSchemaFromZod(asForeignSchema({}))),
          ).toMatchSnapshot();
        });
      });

      when('[t1] the marker is present but hollow', () => {
        then('it fails LOUD, and the refusal names its own mechanism', () => {
          expect(
            asThrownShape(() =>
              getJsonSchemaFromZod(asForeignSchema({ _zod: {} })),
            ),
          ).toMatchSnapshot();
        });
      });

      when('[t2] the marker names a type this copy cannot place', () => {
        then('it fails LOUD, and the refusal names its own mechanism', () => {
          expect(
            asThrownShape(() =>
              getJsonSchemaFromZod(
                asForeignSchema({
                  _zod: { def: { type: 'aTypeFromAnotherCopy' } },
                }),
              ),
            ),
          ).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case9] the two keys the face DROPS — which direction is the repair?',
    () => {
      /**
       * ⚠️ .what = the DIRECTION clamp, and it exists because the direction was read
       *         backwards by THREE independent peer reviewers in one round. each read the
       *         resnapped introspection diff, saw `additionalProperties: false` and a nested
       *         `required` disappear, and graded it a WEAKENING of the published contract
       *
       * .why a test rather than an argument = a snapshot shows WHAT moved and says not one
       *        word about which way. so the convergent misread is evidence about the
       *        ARTIFACT, never about the readers — three careful reviewers who reach one
       *        wrong verdict from one document mean the document cannot carry the verdict.
       *        the repair is a clamp that states the direction and goes red if it inverts
       *
       * ⚠️ .the claim under test = neither key described the INPUT face. a caller reads the
       *        published document to learn what they may SEND, so a key that is false of the
       *        parse is a lie the caller acts on — and both keys were true only of the value
       *        the parse RETURNS. ⇒ the drop is a REPAIR of a published falsehood
       *        (rule.require.measure-the-value-you-emit)
       *
       * .why `[t2]` carries the claim = `[t0]` and `[t1]` alone would be satisfied by a face
       *        that drops the key UNIVERSALLY, which would be its own lie in the other
       *        direction. `[t2]` is the positive control: a schema that genuinely DOES reject
       *        keeps the key. so the face is measured to track the runtime rather than to
       *        blanket-drop (rule.require.positive-control-before-absence-claims)
       *
       * ⚠️ .the bite, and the bound on how it was measured = a revert of the subject's face to
       *        `io: 'output'` does NOT yield a targeted red here — the whole suite fails to RUN,
       *        at `[case5]`'s dobj row, with `Transforms cannot be represented in JSON Schema`.
       *        that IS the crash this change retires, so the revert over-proves the change and
       *        under-proves THIS case (rule.require.clamp-edge-cases)
       *   ⇒ so each row below asserts BOTH faces on ONE schema instead. the pair is what goes
       *     red: `[t0]` and `[t1]` each demand that the shipped face OMITS what the discarded
       *     face STATES, so they fail the day the two converge in either direction — whether
       *     the subject flips its face or zod changes what a face renders
       */
      when(
        '[t0] `additionalProperties` — a plain object meets an extra key',
        () => {
          const schema = z.object({ name: z.string() });

          then(
            'the runtime ACCEPTS it and strips it — it never rejected',
            () => {
              const parsed = schema.safeParse({
                name: 'kai',
                extra: 'surprise',
              });
              expect(parsed.success).toEqual(true);
              expect(parsed.success && parsed.data).toEqual({ name: 'kai' });
            },
          );

          then(
            'so the shipped face omits the key it would have lied with',
            () => {
              expect(getJsonSchemaFromZod(schema)).not.toHaveProperty(
                'additionalProperties',
              );
            },
          );

          then(
            'and the DISCARDED face published `false` — the falsehood',
            () => {
              expect(z.toJSONSchema(schema, { io: 'output' })).toHaveProperty(
                'additionalProperties',
                false,
              );
            },
          );
        },
      );

      when(
        '[t1] `required` — a `.default()` field, the `[case6]` shape',
        () => {
          const schema = z.object({
            limit: z.number().int().min(1).max(100).default(10),
          });

          then(
            'a caller may omit it — so it was never required to SEND',
            () => {
              const parsed = schema.safeParse({});
              expect(parsed.success).toEqual(true);
              expect(parsed.success && parsed.data).toEqual({ limit: 10 });
            },
          );

          then('so the shipped face does not demand it', () => {
            expect(
              (getJsonSchemaFromZod(schema) as JsonFace).required ?? [],
            ).not.toContain('limit');
          });

          then('and the DISCARDED face demanded it — the falsehood', () => {
            expect(
              (z.toJSONSchema(schema, { io: 'output' }) as JsonFace).required ??
                [],
            ).toContain('limit');
          });
        },
      );

      when(
        '[t2] the POSITIVE CONTROL — a schema that truly does reject',
        () => {
          const schema = z.strictObject({ name: z.string() });

          then('the runtime REFUSES the extra key', () => {
            expect(
              schema.safeParse({ name: 'kai', extra: 'surprise' }).success,
            ).toEqual(false);
          });

          then('so the shipped face KEEPS the key — it is true here', () => {
            expect(getJsonSchemaFromZod(schema)).toHaveProperty(
              'additionalProperties',
              false,
            );
          });
        },
      );
    },
  );

  given(
    '[case10] a NATIVE schema this zod cannot render — the guard is not over-broad',
    () => {
      /**
       * ⚠️ .what = the POSITIVE CONTROL for the marker guard's own claim
       * .why = the subject states the guard "fires on exactly the set that already
       *        crashed". that is a claim about a NEGATIVE — the set it does NOT fire on —
       *        and `[case8]` measures only the set it DOES. a guard that refused every
       *        unrenderable schema would keep all three `[case8]` rows green while it
       *        stole the diagnosis from every schema zod already names precisely
       *        (rule.require.positive-control-before-absence-claims)
       *
       * .why `z.custom()` is the specimen = it is a real schema this install built, so its
       *        marker is present and well-formed, AND its render is refused. that pair is
       *        what no `[case8]` row holds: each of those is foreign, so each fails the
       *        marker test for a reason unrelated to renderability
       *
       * ⚠️ .the mechanism, read from zod's own source rather than inferred = every schema
       *        in zod's type union declares `def.type` as a required string literal, and
       *        `z.custom()`'s is `'custom'` — truthy, so it passes `!marker?.def?.type`
       *        untouched. it then reaches `customProcessor`, which throws its own named
       *        error (`zod@4.4.3` `json-schema-processors.cjs:257-259`, and zod clamps the
       *        same string in `to-json-schema.test.ts:309`)
       *   ⇒ so no legitimate `z.*()` schema carries a falsy `def.type`, which is why the
       *     guard reaches only foreign objects and `as any` casts
       *
       * .the bite = widen the subject's guard to fire on renderability rather than on the
       *             marker — say, a `try`/`catch` that re-throws its own error — and `[t0]`
       *             goes RED: the snapshot would carry `MalfunctionError` plus the
       *             split-install hint in place of zod's precise `Custom types` diagnosis
       */
      when('[t0] a `z.custom()` — marker present, render refused', () => {
        then(
          'the MARKER guard passes it through, and the refusal names the type',
          () => {
            /**
             * ⚠️ .what MOVED here, and why it is not a regression = this row read
             *    "and zod names the real cause", and the snapshot carried zod's bare
             *    `Error: Custom types cannot be represented in JSON Schema`. the subject
             *    now runs `unrepresentable: 'any'` so an ABSENT position can publish,
             *    and `setAbsentPositionsRendered` re-raises every other emptied node —
             *    so the refuser is this sdk rather than zod
             *
             * ⇒ the CLAIM this case makes is unchanged and still holds: the marker guard
             *   is not over-broad, and it passes a native schema through. what changed is
             *   WHICH mechanism then refuses, and the new message names the position type
             *   plus the fix where zod's named the kind alone
             *   (rule.require.errors-name-the-fix)
             */
            expect(
              asThrownShape(() => getJsonSchemaFromZod(z.custom(() => true))),
            ).toMatchSnapshot();
          },
        );
      });

      when('[t1] the marker itself, read directly', () => {
        then('a native schema carries a truthy `def.type`', () => {
          const marker = (
            z.custom(() => true) as unknown as {
              _zod: { def: { type: unknown } };
            }
          )._zod;
          expect(marker.def.type).toEqual('custom');
        });
      });

      when('[t2] the `z.lazy()` escape the readme documents', () => {
        /**
         * ⚠️ .why THIS shape specifically = the readme names
         *    `z.lazy(() => X.contract())` as the escape for a self-referential domain
         *    object, since a `static schema` that calls its own `.contract()` throws on
         *    js class-field order. so it is a shape a consumer is DIRECTED to write — and
         *    the guard's "no path that succeeds today" claim covers it by implication
         *    while no run had ever routed it through the door
         *
         * .measured = a lazy's `def.type` is `'lazy'`, truthy, so it passes the guard and
         *             renders. ⇒ the guard does NOT intercept the documented escape
         */
        const schema = z.lazy(() => Surfer.contract());

        then('its marker is truthy, so the guard passes it through', () => {
          const marker = (
            schema as unknown as { _zod: { def: { type: unknown } } }
          )._zod;
          expect(marker.def.type).toEqual('lazy');
        });

        then('and the door RENDERS it — the escape stays usable', () => {
          expect(getJsonSchemaFromZod(schema)).toMatchSnapshot();
        });
      });
    },
  );

  given('[case11] a position that carries NO value', () => {
    /**
     * .what = the clamp on the absent-position render, and on the blanket flag that
     *         makes it reachable
     * .why = `z.undefined()` and `z.void()` are what a handler that returns no value
     *        declares, and zod refuses to render either. so an endpoint that introspects
     *        could not declare one, and its author reached for `z.unknown()` — which
     *        publishes `{}` and tells a caller EVERY value is valid. that is the same
     *        rubber-stamp the wish opened against, one corner in
     *
     * ⚠️ .the bite, and it has TWO halves that must both hold = drop
     *    `unrepresentable: 'any'` from the subject and `[t0]`–`[t3]` go red (zod throws
     *    again). drop the `override` and `[t6]` goes red instead — `z.date()` would
     *    publish `{}` in silence, which is the failhide the flag alone would introduce.
     *    ⇒ neither half is safe alone, and the pair of red sets is what says so
     *    (rule.require.clamp-edge-cases)
     */
    when('[t0] `z.undefined()` at the root', () => {
      then('it publishes `{ not: {} }` rather than throws', () => {
        expect(getJsonSchemaFromZod(z.undefined())).toMatchObject({ not: {} });
      });
    });

    when('[t1] `z.void()` at the root', () => {
      then('it publishes the same — the two declare one sense', () => {
        expect(getJsonSchemaFromZod(z.void())).toMatchObject({ not: {} });
      });
    });

    when('[t2] an absent position at a KEY', () => {
      const schema = z.object({ a: z.string(), b: z.undefined() });

      then('the key renders `{ not: {} }` and STAYS in `required`', () => {
        expect(getJsonSchemaFromZod(schema)).toMatchSnapshot();
      });

      then('and that is honest — the parse demands the key be PRESENT', () => {
        /**
         * ⚠️ .what this row REFUTED = a first draft of the subject stripped an absent key
         *    out of `required`, reasoning that the position accepts the key omitted. this
         *    assertion was written to prove it and returned `false` instead — zod demands
         *    the key be present and hold `undefined`
         *
         * ⇒ so the strip would have published a face that ACCEPTS a document the parse
         *   then rejects. left alone, `required: ['b']` beside `b: { not: {} }` is
         *   unsatisfiable by any json document — which is the truth, since no json
         *   document can carry `undefined` at all
         *
         * .why it stays as a row = the claim it settles is about a dependency's behavior,
         *        and the next zod upgrade could move it either way. an assertion goes red;
         *        a comment does not (rule.require.clamp-edge-cases)
         */
        expect(schema.safeParse({ a: 'crush' }).success).toEqual(false);
        expect(schema.safeParse({ a: 'crush', b: undefined }).success).toEqual(
          true,
        );
      });
    });

    when('[t3] the four shapes an author reaches for, side by side', () => {
      then('each publishes, and the pair of senses stays apart', () => {
        // .why a TABLE = the question this case answers is comparative — "which of these
        //      can i declare?" — and a reader of four separate assertions must hold
        //      four results to answer it
        expect({
          'z.undefined()': getJsonSchemaFromZod(z.undefined()),
          'z.void()': getJsonSchemaFromZod(z.void()),
          'z.null()': getJsonSchemaFromZod(z.null()),
          'z.never()': getJsonSchemaFromZod(z.never()),
        }).toMatchSnapshot();
      });
    });

    when('[t4] what the runtime SERIALIZES for a void return', () => {
      then('no json document crosses at all', () => {
        // ⚠️ .the bound = this measures THIS sdk's serializer, which is what `[case5]`
        //    grades the other six shapes against. what the aws runtime then puts on the
        //    invoke payload for an absent document is a TRANSPORT property, and a
        //    transport claim owes a `deployed.*` twin (define.blackbox-suite-grains).
        //    no such twin exists, so none is claimed here
        expect(
          JSON.stringify(
            getValidatedOutput({ response: undefined, schema: z.undefined() }),
          ),
        ).toEqual(undefined);
      });
    });

    when('[t5] a position that is genuinely OPEN', () => {
      then(
        '`z.unknown()` still publishes `{}` — the open set stays quiet',
        () => {
          // .why the key filter = every root render carries a `$schema`, which is the
          //      document's own dialect marker rather than a constraint on its value
          expect(
            Object.keys(getJsonSchemaFromZod(z.unknown())).filter(
              (key) => key !== '$schema',
            ),
          ).toEqual([]);
        },
      );
    });

    when('[t6] a position the blanket flag would have SILENCED', () => {
      then(
        '`z.date()` still fails loud, and the refusal names the type',
        () => {
          // .why = this is the half of the clamp that guards the flag itself. with the
          //        override removed, this position publishes `{}` — a rubber-stamp a
          //        caller cannot tell from an open one (rule.forbid.failhide)
          expect(
            asThrownShape(() => getJsonSchemaFromZod(z.date())),
          ).toMatchSnapshot();
        },
      );
    });

    when('[t7] a coerced dobj, rendered BESIDE the blanket flag', () => {
      then('the `x-domain-object` pragma holds — this is not `#33`', () => {
        // ⚠️ .why this row exists = `#33` is `unrepresentable: 'any'` used INSTEAD of
        //    `{ io: 'input' }`, which renders every coerced dobj as `{}` and destroys
        //    this pragma with no tell. the flag now ships, so the claim that it is
        //    harmless BESIDE `io: 'input'` owes a run rather than an argument
        const face = getJsonSchemaFromZod(
          z.object({ surfer: Surfer.contract() }),
        ) as {
          properties?: Record<
            string,
            { 'x-domain-object'?: { name?: string } }
          >;
        };
        expect(face.properties?.surfer?.['x-domain-object']?.name).toEqual(
          'Surfer',
        );
      });
    });

    /**
     * ⚠️ .what = the FALSE REFUSAL the first draft of this branch shipped, pinned
     * .why = a wrapper node renders whatever its inner rendered, so a legal `z.any()` under
     *        an `.optional()` reaches the override as an `optional` node that carries `{}`.
     *        the first draft read that emptiness as a silence and threw — it refused the one
     *        shape the re-raise exists to PERMIT
     *
     * .the bite, measured = `[case17][t2]` of `genLambdaEndpoint.forApiGateway.test.ts` went
     *        200 -> 500, because `asApiGatewayResponseSchema` writes `body:
     *        input.body.optional()` and every api-gateway body is therefore wrapped. so the
     *        defect reached a whole FAMILY, never one call site
     *
     * .the bite, here = delete `getIsNodeWithInner` from the re-raise condition and `[t8]`
     *        goes RED (measured: `10 passed, 1 failed`). restore it and it goes green
     *        (rule.require.clamp-edge-cases)
     *
     * ⚠️ .and `[t9]` does NOT go red under that revert — measured, against my own first
     *    claim that it would. it is an ORDER clamp rather than a guard clamp: zod runs the
     *    override deepest-first (`[...ctx.seen.entries()].reverse()`,
     *    `to-json-schema.cjs:302`), so `date` throws before `optional` is ever reached and
     *    the name is right today either way. it goes red only if that order changes — which
     *    `flattenRef`'s parent recursion at line 279 already makes reachable. so it clamps a
     *    property of the VENDOR, and it is kept for exactly that
     */
    when('[t8] an open position under a wrapper', () => {
      then(
        '`z.any().optional()` publishes — the wrapper is not the culprit',
        () => {
          expect(
            Object.keys(
              getJsonSchemaFromZod(z.object({ body: z.any().optional() })),
            ),
          ).toContain('properties');
        },
      );
    });

    when('[t9] an un-renderable position under a wrapper', () => {
      then('the refusal names the INNER type, never the wrapper', () => {
        // .why the name matters = `optional` is true of thousands of positions and points
        //      an engineer at no field. `date` is the one they must change
        expect(
          asThrownShape(() =>
            getJsonSchemaFromZod(z.object({ at: z.date().optional() })),
          ),
        ).toMatchSnapshot();
      });
    });
  });
});
