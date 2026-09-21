import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP } from '../../domain.objects/LambdaEndpointErrorResponseBody';
import { genLambdaEndpoint } from '../genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
import { getIsWrappedPayload } from '../lambdaEndpointWire/frame/getIsWrappedPayload';
import { asLambdaEndpointErrorEnvelopeContemp } from './dialect/isLambdaEndpointErrorEnvelope';
import { onReferenced } from './runLambdaEndpoint.onReferenced';

/**
 * .what = an endpoint that echoes a uuid, and rejects a malformed one
 * .why = the minimum shape that exercises success + constraint rejection
 */
const genEchoEndpoint = () =>
  genLambdaEndpoint({
    schema: {
      input: z.object({ uuid: z.string().uuid() }),
      output: z.object({ uuid: z.string(), seenAt: z.string() }),
    },
    invoke: async ({ event }) => ({
      uuid: event.uuid,
      seenAt: '2026-09-08T00:00:00.000Z',
    }),
  });

const UUID_GOOD = '11111111-1111-4111-8111-111111111111';

describe('runLambdaEndpoint.onReferenced', () => {
  given('[case2] an endpoint that rejects a malformed uuid', () => {
    const handler = genEchoEndpoint();

    when('[t0] a valid event is run', () => {
      const result = useThen('it resolves', async () =>
        onReferenced({ event: { uuid: UUID_GOOD }, handler }),
      );

      then('it returns the handler output', () => {
        expect(result).toMatchObject({ uuid: UUID_GOOD });
      });

      then('it did NOT throw', () => {
        expect(result).toBeDefined();
      });

      // 🔴 the END-TO-END success value of a real `genLambdaEndpoint` handler.
      //    `toMatchObject` reads ONE key, so a reshape that dropped `seenAt`
      //    or added a field passes it. every value here is a fixed fixture.
      then('the whole success shape is pinned', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] a caller-fault event is run', () => {
      const result = useThen('it RESOLVES, never rejects', async () =>
        onReferenced({ event: { uuid: 'not-a-uuid' }, handler }),
      );

      then('the constraint envelope is RETURNED, not thrown', () => {
        // the lambda succeeded — it told the caller their request was invalid
        // (invariant.badrequesterror-not-lambda-error)
        expect(result).toHaveProperty('error');
      });

      then('the dialect is contemp by DEFAULT', () => {
        expect(result).toMatchObject({
          error: {
            _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
            class: 'ConstraintError',
          },
        });
      });

      // 🔴 the REAL envelope a genLambdaEndpoint zod rejection produces —
      //    message text and all. `publicSurfaceShapes.test.ts` pins a
      //    hand-authored one from another handler, so no other test holds this
      //    end-to-end shape.
      then('the whole envelope is pinned, message and all', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case5] an endpoint whose caller declares the ancient dialect', () => {
    const handler = genEchoEndpoint();

    when('[t0] no struct is declared', () => {
      const result = useThen('it resolves', async () =>
        onReferenced({ event: { uuid: 'not-a-uuid' }, handler }),
      );

      then('the envelope is contemp — the wrapper is the default frame', () => {
        expect(result).toHaveProperty('error');
        expect(result).not.toHaveProperty('errorType');
      });

      // the DIALECT PAIR is the claim of this given, and a `toHaveProperty`
      // read cannot show a reviewer the two shapes side by side. the snapshots
      // in this block do.
      then('the contemp shape is pinned', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] struct.payload is ancient', () => {
      const result = useThen('it resolves', async () =>
        onReferenced({
          event: { uuid: 'not-a-uuid' },
          handler,
          struct: { payload: 'ancient' as const },
        }),
      );

      then('the envelope is the flat ancient shape', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(result).not.toHaveProperty('error');
      });

      then('the ancient shape is pinned, beside its contemp peer', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1b] an ancient declaration is paired with a trail', () => {
      const result = useThen('it resolves', async () =>
        onReferenced({
          event: { uuid: 'not-a-uuid' },
          handler,
          struct: { payload: 'ancient' as const },
          trail: { exid: 'exid:test-1' },
        }),
      );

      // 🔴 the F9 bound, closed by derivation rather than policed.
      // the frame follows struct.payload, so a trail cannot silently flip the
      // dialect out from under the declared return type. what the design must
      // NOT do is settle to a contemp envelope under an ancient declaration.
      then('the trail does NOT flip the dialect', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(result).not.toHaveProperty('error');
      });

      // 🟡 this snapshot must read IDENTICALLY to `[t1]`'s — that identity IS
      //    the F9 bound. two `toMatchObject` reads cannot report a divergence
      //    between the ancient envelope with a trail and the one without.
      then('and the shape is byte-identical to the trail-less one', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] a contemp declaration is paired with a trail', () => {
      const result = useThen('it resolves', async () =>
        onReferenced({
          event: { uuid: 'not-a-uuid' },
          handler,
          trail: { exid: 'exid:test-2' },
        }),
      );

      then('it stays contemp — the trail supplies the exid only', () => {
        expect(result).toMatchObject({
          error: { class: 'ConstraintError' },
        });
      });

      // 🔴 the caller's own exid is `'exid:test-2'`, a FIXED literal — so if
      //    the trail leaked into the envelope this snapshot would show it,
      //    where the one-key `toMatchObject` above could not.
      then('the trail does not leak into the envelope', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t5] the util builds a wrapped payload', () => {
      // 🔴 a genLambdaEndpoint handler cannot witness this: genTrailMiddleware
      //    absorbs the wrapper at position 2, so by the time the handler runs
      //    the frame is gone. only a RAW handler sees the payload as built.
      then(
        'the wrapper carries exactly event and trail — no third key',
        async () => {
          const seen: unknown[] = [];
          const capture = async (event: unknown) => {
            seen.push(event);
            return { ok: true };
          };

          await onReferenced({
            event: { uuid: UUID_GOOD },
            handler: capture,
            trail: { exid: 'exid:test-5' },
          });

          // exactly-two-keys is not a stylistic claim: getIsWrappedPayload
          // ACCEPTS a payload only with exactly `event` and `trail`
          // (getIsWrappedPayload.ts:32-41). a third key silently demotes the
          // call to the ancient dialect, which is the strip-vs-wrap order
          // interaction cell #8 exists to name.
          expect(Object.keys(seen[0] as object).sort()).toEqual([
            'event',
            'trail',
          ]);
          expect(getIsWrappedPayload(seen[0])).toEqual(true);

          // 🔴 the WHOLE payload as built, exid included — the caller supplied
          //    `'exid:test-5'`, a fixed literal, so the wrapper is fully
          //    deterministic. a key-set read cannot show a reviewer what the
          //    two keys CARRY, which is the other half of cell #8's claim.
          expect(seen[0]).toMatchSnapshot();
        },
      );
    });
  });

  given('[case3] an endpoint whose handler raises a malfunction', () => {
    const handler = genLambdaEndpoint({
      schema: {
        input: z.object({ uuid: z.string() }),
        output: z.object({ uuid: z.string() }),
      },
      invoke: async () => {
        throw new MalfunctionError('the database is on fire');
      },
    });

    when('[t0] the endpoint is run', () => {
      then('it THROWS — the util adds no catch', async () => {
        await expect(
          onReferenced({ event: { uuid: UUID_GOOD }, handler }),
        ).rejects.toThrow('the database is on fire');

        const thrown = await getError(
          onReferenced({ event: { uuid: UUID_GOOD }, handler }),
        );
        expect({
          class: thrown.constructor.name,
          message: thrown.message,
        }).toMatchSnapshot();
      });
    });

    when('[t1] the ancient dialect is declared', () => {
      then(
        'it THROWS on that dialect too — the frame is inert here',
        async () => {
          await expect(
            onReferenced({
              event: { uuid: UUID_GOOD },
              handler,
              struct: { payload: 'ancient' as const },
            }),
          ).rejects.toThrow('the database is on fire');

          // 🟡 *"the frame is inert"* is a claim about IDENTITY — this
          //    snapshot must read the same as `[t0]`'s. a `rejects.toThrow`
          //    on each dialect cannot report a divergence between them.
          const thrown = await getError(
            onReferenced({
              event: { uuid: UUID_GOOD },
              handler,
              struct: { payload: 'ancient' as const },
            }),
          );
          expect({
            class: thrown.constructor.name,
            message: thrown.message,
          }).toMatchSnapshot();
        },
      );
    });
  });

  given('[case4] an endpoint given a wire-hostile event', () => {
    when('[t0] the event carries a Date', () => {
      const seen: unknown[] = [];
      const handler = async (event: unknown) => {
        seen.push(event);
        return { ok: true };
      };

      then(
        'the handler receives a STRING, as the wire would deliver',
        async () => {
          await onReferenced({
            event: { at: new Date('2026-09-08T00:00:00.000Z') },
            handler,
          });

          const payload = seen[0] as { event: { at: unknown } };
          expect(typeof payload.event.at).toEqual('string');
          expect(payload.event.at).toEqual('2026-09-08T00:00:00.000Z');

          // the STRIPPED payload as the handler sees it — the wire-fidelity
          // claim in full, rather than one field of it
          expect(payload).toMatchSnapshot();
        },
      );
    });

    when('[t1] the event carries an undefined field', () => {
      const seen: unknown[] = [];
      const handler = async (event: unknown) => {
        seen.push(event);
        return { ok: true };
      };

      then('the field is dropped, as json drops it', async () => {
        await onReferenced({
          event: { kept: 'yes', dropped: undefined },
          handler,
        });

        const payload = seen[0] as { event: Record<string, unknown> };
        expect(payload.event).toEqual({ kept: 'yes' });
        expect('dropped' in payload.event).toEqual(false);

        expect(payload).toMatchSnapshot();
      });
    });

    // 🔴 the VOID DIVERGENCE, clamped on the half this file owns.
    //
    //    a handler that returns no value answers `undefined` HERE and `null` on
    //    the serialized boundary (`onSerialized`'s `JSON.stringify(output ?? null)`,
    //    because aws delivers `null` for a lambda that returns no value).
    //
    //    ⇒ both are correct: this boundary is HOST-faithful, that one is
    //      WIRE-faithful. the same split as the error stance, one level down.
    //
    //    🟡 it is the SQS/SNS consumer shape, so a migrant meets it on their
    //      first pair of tests. `define.lambda-endpoint-run-boundary` states it
    //      in prose.
    when('[t6] the handler returns no value', () => {
      const handlerVoid = async () => {
        // a consumer handler: it acts, and answers with no value
      };

      then(
        'the referenced boundary answers undefined, never null',
        async () => {
          const res = await onReferenced({
            event: { uuid: UUID_GOOD },
            handler: handlerVoid,
          });

          expect(res).toEqual(undefined);
          expect(res).not.toEqual(null);

          // 🔴 `undefined` and `null` both serialize as absent in a bare
          //    snapshot, so the DIVERGENCE is masked into a typed report —
          //    otherwise this pin could not tell the two boundaries apart,
          //    which is the entire claim of the block.
          expect({
            answer: res === undefined ? 'undefined' : String(res),
            isNull: res === null,
          }).toMatchSnapshot();
        },
      );
    });

    when('[t5] the HANDLER returns a wire-hostile output', () => {
      const handler = async () => ({
        at: new Date('2026-09-08T00:00:00.000Z'),
      });

      // 🔴 aws serializes the RESPONSE too, so an input-only strip would let a
      // test assert on an output shape the wire could never deliver.
      then(
        'the output is stripped too — the guard is two-directional',
        async () => {
          const result = await onReferenced({ event: {}, handler });
          expect(typeof (result as { at: unknown }).at).toEqual('string');

          // the OUTPUT half of the two-directional guard, pinned as a value —
          // a `typeof` read passes on any string at all, so it could not
          // catch a strip that mangled the timestamp
          expect(result).toMatchSnapshot();
        },
      );
    });

    when('[t3] the author reuses their event object after the run', () => {
      const handler = async () => ({ ok: true });

      then('the strip COPIES — the author input is not mutated', async () => {
        const event = { at: new Date('2026-09-08T00:00:00.000Z') };
        await onReferenced({ event, handler });
        expect(event.at).toBeInstanceOf(Date);

        // masked: the claim is that the AUTHOR's object survived as a live
        // Date. a raw snapshot of a Date renders as its iso string, which is
        // exactly what a mutated (stripped) object would render as too.
        expect({
          authorInputStillADate: event.at instanceof Date,
          authorInputValue: event.at.toISOString(),
        }).toMatchSnapshot();
      });
    });

    // 🔴 the WHOLE event is absent. `asWireStripped` early-returns on
    //    `undefined`, so absent this guard the value flows THROUGH and the
    //    fault surfaces inside the CALLER's handler — further from its cause.
    when('[t4] the whole event is undefined', () => {
      const handler = async (event: { slug: string }) => ({ slug: event.slug });

      // [t4].a — it is REFUSED, by name, before the handler runs
      then('a named ConstraintError names the util and the fix', async () => {
        const error = await getError(
          onReferenced({
            event: undefined as unknown as { slug: string },
            handler,
          }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('no event was given');
        expect(error.message).toContain('event: {}');

        expect({
          class: error.constructor.name,
          messageNamesNoEvent: error.message.includes('no event was given'),
          messageNamesFix: error.message.includes('event: {}'),
        }).toMatchSnapshot();
      });

      // 🔴 [t4].b — the TEETH, and they clamp the SILENT failure. absent the
      //    guard a handler that merely READS a field gets no error at all — it
      //    answers a success-shaped value. only one that DESTRUCTURES throws.
      //
      //    ⇒ so this asserts the handler is never REACHED, never that it
      //      throws — the throw is the loud half (rule.forbid.failhide).
      then('the handler is never reached', async () => {
        const seen: unknown[] = [];
        const handlerWatched = async (event: { slug: string }) => {
          seen.push(event);
          return { slug: event.slug };
        };

        await getError(
          onReferenced({
            event: undefined as unknown as { slug: string },
            handler: handlerWatched,
          }),
        );

        expect(seen).toEqual([]);

        // 🟡 an ABSENCE is what a field read defends worst — `toEqual([])`
        //    passes whether the handler was skipped or the capture array was
        //    never wired. the count states which.
        expect({ handlerInvocations: seen.length }).toMatchSnapshot();
      });

      // [t4].c — `{}` is NOT refused. the corpus convention for "no input" is
      // an empty object, and to reject it would break the majority actor.
      then('an EMPTY event is allowed — `{}` is the convention', async () => {
        const handlerEmpty = async () => ({ ok: true });
        const res = await onReferenced({ event: {}, handler: handlerEmpty });
        expect(res).toEqual({ ok: true });

        // the one empty-input SUCCESS variant of this boundary — the path the
        // majority of legacy call sites take, and no other test holds it
        expect(res).toMatchSnapshot();
      });
    });
  });

  given('[case7] a legacy handler, never migrated to genLambdaEndpoint', () => {
    // nia's actor: 19 of 20 repos, 314 of 318 legacy call sites.
    // a plain async handler, with no endpoint factory anywhere in sight.
    const handler = async (event: { uuid?: string }) => {
      if (!event || typeof event !== 'object')
        return { errorMessage: 'bad', errorType: 'BadRequestError' };
      return { uuid: event.uuid ?? null };
    };

    when('[t0] the author declares the ancient dialect', () => {
      then('a plain handler runs — no endpoint type is demanded', async () => {
        const result = await onReferenced({
          event: { uuid: UUID_GOOD },
          handler,
          struct: { payload: 'ancient' as const },
        });
        expect(result).toEqual({ uuid: UUID_GOOD });

        // 🔴 the 95% actor's success path. the three snapshots in this given
        //    are read as a SET: ancient succeeds, contemp nulls the field,
        //    the ancient declaration restores it. a reviewer sees the whole
        //    interaction in one file rather than three `toEqual` calls.
        expect(result).toMatchSnapshot();
      });
    });

    // 🔴 the clamp case=7 rests on: the two arms that demo the swap declare NO
    //    `struct`. a `struct: { payload: 'ancient' }` would be a SECOND change,
    //    so the title would claim a one-line swap while the body did two — a
    //    failhide in a title, green either way.
    when('[t1] the author swaps ONLY the import, as case=7 demos it', () => {
      then(
        'the contemp default wraps her event — the swap is 2 lines',
        async () => {
          // what nia actually receives, with no `struct` declared
          const seen: unknown[] = [];
          const spy = async (payload: unknown) => {
            seen.push(payload);
            return { ok: true };
          };

          await onReferenced({ event: { uuid: UUID_GOOD }, handler: spy });

          // 🔴 the contemp default FRAMES the input (asFramedPayload.ts:51-55), and
          //    the legacy family never unwraps it — `simple-lambda-handlers` carries
          //    zero trail code, verified by search. so her handler's own fields sit
          //    one level down, and a `createStandardHandler` handler that reads
          //    `event.uuid` sees undefined.
          expect(seen[0]).toEqual({ event: { uuid: UUID_GOOD }, trail: {} });
          expect(seen[0]).not.toEqual({ uuid: UUID_GOOD });

          expect(seen[0]).toMatchSnapshot();
        },
      );

      then('so a legacy handler finds its fields absent', async () => {
        // nia's handler, verbatim — it reads the event's own field
        const result = await onReferenced({
          event: { uuid: UUID_GOOD },
          handler,
        });

        // 🔴 `uuid: null`, never UUID_GOOD. her assertion would fail, and it
        //    would fail in the direction that reads as "my handler broke".
        expect(result).toEqual({ uuid: null });

        // 🔴 the DEFECT this demo exists to name, pinned. a reviewer reads the
        //    `null` beside the two `UUID_GOOD` snapshots in this block and the
        //    whole framing interaction is legible with no trip into source.
        expect(result).toMatchSnapshot();
      });

      then('the ancient declaration is what makes it work', async () => {
        const result = await onReferenced({
          event: { uuid: UUID_GOOD },
          handler,
          struct: { payload: 'ancient' as const },
        });
        expect(result).toEqual({ uuid: UUID_GOOD });

        expect(result).toMatchSnapshot();
      });
    });

    /**
     * 🔴 the FAILURE half of F7's parity claim — *the util is opinion-free*.
     *
     * `[case3]` proves an ENDPOINT handler's throw crosses untouched; the other
     * `[case7]` blocks prove a PLAIN handler's success does. neither proves a
     * plain handler's THROW does, and that is where a narrow would hide: a
     * `try/catch` that "normalizes legacy errors into an envelope" keeps every
     * other block green and converts a throw into a return for 19 of 20 repos.
     */
    when('[t2] a plain handler THROWS', () => {
      then('the throw crosses untouched — no envelope, no catch', async () => {
        const boom = async () => {
          throw new MalfunctionError('the legacy database is on fire');
        };

        await expect(
          onReferenced({ event: { uuid: UUID_GOOD }, handler: boom }),
        ).rejects.toThrow('the legacy database is on fire');

        const thrown = await getError(
          onReferenced({ event: { uuid: UUID_GOOD }, handler: boom }),
        );
        expect({
          class: thrown.constructor.name,
          message: thrown.message,
        }).toMatchSnapshot();
      });

      then('the ERROR CLASS survives, never a re-wrap', async () => {
        // 🔴 a util that caught and re-raised would satisfy the message
        //    assertion above while it destroyed the class — a clamp on a
        //    fragment of the claim passes on a breach of the rest.
        const boom = async () => {
          throw new MalfunctionError('the legacy database is on fire');
        };

        const thrown = await getError(
          onReferenced({ event: { uuid: UUID_GOOD }, handler: boom }),
        );
        expect(thrown).toBeInstanceOf(MalfunctionError);

        expect({
          class: thrown.constructor.name,
          message: thrown.message,
        }).toMatchSnapshot();
      });

      then(
        'a plain Error survives too — the util owns no taxonomy',
        async () => {
          // the legacy family predates helpful-errors, so nia's handler may raise
          // a bare Error. a util that normalized it into a MalfunctionError would
          // be an OPINION, which is precisely what F7 says this util does not hold.
          const boom = async () => {
            throw new Error('a bare legacy error');
          };

          const thrown = await getError(
            onReferenced({ event: { uuid: UUID_GOOD }, handler: boom }),
          );
          expect(thrown.message).toEqual('a bare legacy error');
          expect(thrown).not.toBeInstanceOf(MalfunctionError);

          expect({
            class: thrown.constructor.name,
            message: thrown.message,
          }).toMatchSnapshot();
        },
      );
    });

    when('[t4] a plain function is handed to the util', () => {
      then('it runs — no genLambdaEndpoint type is demanded', async () => {
        // the structural guard on F7. a contributor who narrows the handler
        // parameter to a genLambdaEndpoint type keeps every sdk test green —
        // they all use endpoints — and locks 19 repos out. this handler is a
        // bare async function, so a narrowed type breaks the compile.
        const plain = async (event: { a: number }) => ({ b: event.a });

        // 🟡 `ancient` because this given is the LEGACY handler — the contemp
        //    default hands it the wrapper rather than the event.
        const result = await onReferenced({
          event: { a: 1 },
          handler: plain,
          struct: { payload: 'ancient' as const },
        });
        expect(result).toEqual({ b: 1 });

        // the plain-FUNCTION passthrough — a distinct positive variant from
        // the plain-HANDLER arms above, and the structural guard on F7
        expect(result).toMatchSnapshot();
      });
    });
  });

  given(
    '[edge] an endpoint whose caller sends a constraint error natively',
    () => {
      const handler = genLambdaEndpoint({
        schema: {
          input: z.object({ uuid: z.string() }),
          output: z.object({ uuid: z.string() }),
        },
        invoke: async () => {
          throw new ConstraintError('the uuid names no known surfer');
        },
      });

      when('[t0] the handler raises a constraint error itself', () => {
        const result = useThen('it resolves', async () =>
          onReferenced({ event: { uuid: UUID_GOOD }, handler }),
        );

        then('the envelope is returned, never thrown', () => {
          expect(result).toMatchObject({
            error: { class: 'ConstraintError' },
          });
        });

        then('the author message survives the boundary', () => {
          // helpful-errors prefixes its own class tag ('✋ ConstraintError: ')
          // and the util RELAYS it — so this asserts the author's text survives,
          // never a shape this util invents.
          //
          // 🔴 the dialect NARROW, never an `as` cast — a union field read does
          //    not compile, so the narrow is what is owed (rule.forbid.as-cast).
          const envelope = asLambdaEndpointErrorEnvelopeContemp(result);
          expect(envelope.error.message).toContain(
            'the uuid names no known surfer',
          );

          // 🔴 the envelope a handler-RAISED constraint error produces, which
          //    is a distinct variant from `[case2][t1]`'s zod-raised one. the
          //    `toContain` read cannot show the prefix helpful-errors adds,
          //    and that prefix is what this block claims survives.
          expect(result).toMatchSnapshot();
        });
      });
    },
  );

  /**
   * 🔴 the migration clamp. 318 call sites move onto this operation, and the
   * likeliest slip is the IMPORT — a wrong export name binds `handler` to
   * `undefined`, and the bare `TypeError` names neither this util nor the fix.
   */
  given('[case12] the handler is not a function — a bad import', () => {
    when('[t0] the handler is undefined', () => {
      then(
        'it throws a named ConstraintError, not a bare TypeError',
        async () => {
          const error = await getError(
            onReferenced({
              event: { uuid: 'any' },
              // the shape an `any`-typed import produces on a wrong export name
              handler: undefined as never,
            }),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('is not a function');

          expect({
            class: error.constructor.name,
            messageNamesNotAFunction:
              error.message.includes('is not a function'),
          }).toMatchSnapshot();
        },
      );

      then('the error names the fix', async () => {
        const error = await getError(
          onReferenced({ event: {}, handler: undefined as never }),
        );

        // rule.require.errors-name-the-fix — point the migrant at the import
        expect(error.message).toContain('check the import');

        expect({
          class: error.constructor.name,
          messageNamesTheImport: error.message.includes('check the import'),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the whole module was passed instead of the handler', () => {
      then('it throws, rather than call an object', async () => {
        const error = await getError(
          onReferenced({
            event: {},
            // the second-likeliest slip: `import * as handler from './x'`
            handler: { handle: async () => ({}) } as never,
          }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('never its module');

        expect({
          class: error.constructor.name,
          messageNamesModuleSlip: error.message.includes('never its module'),
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * 🔴 the F8 clamp — a callback-style handler, refused at the boundary.
   *
   * the incumbent supports BOTH shapes, so a migrant with a callback handler
   * crosses into a narrower contract here.
   *
   * ⚠️ absent the guard the failure is a FAILHIDE, not a hang: a callback
   *    handler answers `undefined` rather than a promise, so the await resolves
   *    at once on a green path and the later `callback(err, result)` throws out
   *    of band with no test to fail.
   */
  given('[case13] a callback-style handler, from the incumbent', () => {
    when('[t0] the handler declares a third parameter', () => {
      then(
        'it throws a named ConstraintError rather than answer undefined',
        async () => {
          const error = await getError(
            onReferenced({
              event: { uuid: 'any' },
              // the incumbent's supported shape: (event, context, callback)
              handler: ((
                _event: unknown,
                _context: unknown,
                callback: (err: unknown, out: unknown) => void,
              ) => {
                callback(null, { ok: true });
              }) as never,
            }),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('callback-style');

          expect({
            class: error.constructor.name,
            messageNamesCallbackStyle: error.message.includes('callback-style'),
          }).toMatchSnapshot();
        },
      );

      then('the error names BOTH the fix and its escape', async () => {
        const error = await getError(
          onReferenced({
            event: {},
            handler: ((_e: unknown, _c: unknown, _cb: unknown) =>
              undefined) as never,
          }),
        );

        // rule.require.errors-name-the-fix
        expect(error.message).toContain('async (event, context)');
        // and the false positive it must not strand: a promise handler that
        // merely DECLARES a third parameter it never calls
        expect(error.message).toContain('drop it from the signature');

        expect({
          messageNamesFix: error.message.includes('async (event, context)'),
          messageNamesEscape: error.message.includes(
            'drop it from the signature',
          ),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the handler declares two parameters', () => {
      then(
        'it runs — the guard discriminates by arity, never by shape',
        async () => {
          const out = await onReferenced({
            event: { uuid: 'any' },
            handler: (async (_event: unknown, _context: unknown) => ({
              found: true,
            })) as never,
          });

          expect(out).toEqual({ found: true });

          // the ACCEPT half of the arity guard — its refusal arms are snapped
          // in `[t0]`, and a guard is only legible beside what it lets through
          expect(out).toMatchSnapshot();
        },
      );
    });

    when('[t2] a middy-wrapped endpoint is given', () => {
      then('it is NOT caught by the arity guard', async () => {
        // 🔴 the false-positive clamp that matters most. every handler in the
        //    measured population is middy-wrapped, so if middy's returned
        //    function declared three parameters this guard would reject 100% of
        //    real consumers — and the other cases here would not have shown it.
        const out = await onReferenced({
          event: { uuid: UUID_GOOD },
          handler: genEchoEndpoint(),
        });

        expect(out).toMatchObject({ uuid: UUID_GOOD });

        // 🔴 the false-positive clamp for 100% of real consumers. a one-key
        //    `toMatchObject` would pass on a refusal envelope that happened to
        //    carry a `uuid`; the whole-shape pin cannot.
        expect(out).toMatchSnapshot();
      });
    });
  });

  /**
   * 🔴 the F6 ESCAPE HATCH. `onSerialized` refuses a `context` override — the
   * identity is DERIVED from the endpoint you named — so the readme sends that
   * migrant here, and an advertised hatch owes a test.
   *
   * ⚠️ `asLambdaContext.test.ts` proves the TRANSFORMER honors an override; it
   *    says naught about whether `onReferenced` ever hands it one. delete the
   *    `context` parameter and every other assertion in this file stays green.
   */
  given('[case14] a caller who must pin the lambda identity itself', () => {
    when('[t0] a context override is supplied', () => {
      then(
        'the handler sees the FORGED identity, not the default',
        async () => {
          const seen: {
            functionName?: string;
            memoryLimitInMB?: string;
            awsRequestId?: string;
            invokedFunctionArn?: string;
            logGroupName?: string;
          } = {};

          await onReferenced({
            event: { uuid: UUID_GOOD },
            handler: async (_event: unknown, context) => {
              seen.functionName = context.functionName;
              seen.memoryLimitInMB = context.memoryLimitInMB;
              seen.awsRequestId = context.awsRequestId;
              seen.invokedFunctionArn = context.invokedFunctionArn;
              seen.logGroupName = context.logGroupName;
              return { ok: true };
            },
            context: {
              functionName: 'whatever-you-need',
              memoryLimitInMB: '512',
            },
          });

          expect(seen.functionName).toEqual('whatever-you-need');
          expect(seen.memoryLimitInMB).toEqual('512');

          // 🔴 the claim is not *"the two forged fields arrived"* but *"the
          //    BOUNDARY delivered a whole identity with my two fields in it"*.
          //    the three un-forged fields are captured on purpose — a reshape
          //    that dropped the merge would forge correctly and lose them, and
          //    the two reads above would still pass.
          expect(seen).toMatchSnapshot();
        },
      );

      then('a field left unstated still gets its default', async () => {
        // 🟡 the override is a PARTIAL, so it must merge rather than replace —
        //    a migrant who pins one field must not lose the other fifteen.
        const seen: { awsRequestId?: string } = {};

        await onReferenced({
          event: { uuid: UUID_GOOD },
          handler: async (_event: unknown, context) => {
            seen.awsRequestId = context.awsRequestId;
            return { ok: true };
          },
          context: { functionName: 'whatever-you-need' },
        });

        // 🔴 `expect.any(String)` would be nearly vacuous here: the default
        //    `awsRequestId` is a FIXED literal, so an implementation that
        //    answered any string at all — or the empty one — would pass it.
        expect(seen.awsRequestId).toEqual(
          '00000000-0000-4000-8000-000000000000',
        );
        expect(seen).toMatchSnapshot();
      });
    });
  });
});
