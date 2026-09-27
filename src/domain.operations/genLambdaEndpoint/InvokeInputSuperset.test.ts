import { given, then, when } from 'test-fns';

import type {
  ApiGatewayHeadersMerged,
  ApiGatewayRequestEventUnified,
} from './genLambdaEndpoint.forApiGateway/ApiGatewayRequestEventUnified';
import type { ForApiGatewayInput } from './genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import type {
  AskEventUnified,
  GenLambdaEndpointInput,
} from './genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import type { ForSqsPerBatchInput } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perBatch';
import type { ForSqsPerRecordInput } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perRecord';
import type {
  SqsEventDecoded,
  SqsHeadersMerged,
  SqsRecordDecoded,
} from './genLambdaEndpoint.forSqs/SqsEventDecoded';
import type {
  InvokeInputSuperset,
  SatisfiesInvokeInputSuperset,
} from './InvokeInputSuperset';

/**
 * .what = the clamp on `rule.require.consistent-variant-contracts` — every
 *         `genLambdaEndpoint.for*` variant's `invoke` input is a subset of one superset, in
 *         terminology, shape, and sense. exclusions allowed, divergences forbidden
 *
 * .why both a type gate and a runtime read = they catch different halves, and each is blind
 *        where the other bites:
 *
 *          the type gate    -> catches a slot whose shape diverges. a runtime key read cannot
 *                              see a type at all
 *          the runtime read -> catches a slot whose name diverges, and carries it into
 *                              `--what unit` where a reviewer reads the failure as a sentence
 *
 *        a slot re-declared on a contract type alone type-checks every call site and is still
 *        wrong, so the runtime half is never decorative (`domain.terms/trail.md`)
 *
 * .why one file at the family root and not one case per variant = the claim is about the
 *        variants together. a per-variant clamp cannot go red on a divergence, because a
 *        divergence is a relation between two of them (`rule.require.sweep-the-defect-class`)
 */

/** the shapes each variant binds, written once so a reader can line the four up */
type Headers = { authorization: string };
type Payload = { to: string };
type Body = { sent: boolean };
type AskEvent = { name: string };

type SqsShape = {
  headers: SqsHeadersMerged<Headers>;
  payload: Payload;
};

/**
 * .what = each variant's `invoke` input, lifted off its own PUBLIC contract type
 * .why = read off the contract rather than restated, so a rename there reaches this clamp with
 *        no edit. a restatement is a second copy that drifts (`rule.forbid.parallel-codepaths`)
 */
type InputOfAskEndpoint = Parameters<
  GenLambdaEndpointInput<AskEvent, { ok: boolean }>['invoke']
>[0];
type InputOfApiGateway = Parameters<
  ForApiGatewayInput<Headers, Payload, Body>['invoke']
>[0];
type InputOfSqsPerRecord = Parameters<
  ForSqsPerRecordInput<Headers, Payload>['invoke']
>[0];
type InputOfSqsPerBatch = Parameters<
  ForSqsPerBatchInput<Headers, Payload>['invoke']
>[0];

/**
 * .what = THE TYPE GATE. each verdict resolves to `true` where that variant conforms, and to
 *         a named error object where it does not — so `--what types` refuses the `true` literal
 *         and prints the rule's own sentence beside the slot at fault
 *
 * .how to read a failure = the error object names which half broke. `DIVERGES in name` means the
 *         superset does not name a slot the variant carries; `DIVERGES in shape` means the word
 *         matches and the type does not; `DIVERGES in sense` means `event` is not an envelope
 *         that holds the body
 *
 * .note = the shapes passed here are supplied by this file, so they alone could not catch an
 *         `event` bound to the body — `forAsk` once shipped exactly that and passed. the sense
 *         half reads the contract's own input, so it holds whatever shapes are supplied
 *
 * .note = a variant that EXCLUDES a slot is silent here, by construction — the verdict compares
 *         only the keys the variant carries. that is *"exclusions allowed"*, held in the type
 */
const VERDICT_ASK_ENDPOINT: SatisfiesInvokeInputSuperset<
  InputOfAskEndpoint,
  {
    headers: never;
    payload: AskEvent;
    event: AskEventUnified<AskEvent>;
    record: never;
  }
> = true;

const VERDICT_API_GATEWAY: SatisfiesInvokeInputSuperset<
  InputOfApiGateway,
  {
    headers: ApiGatewayHeadersMerged<Headers>;
    payload: Payload;
    event: ApiGatewayRequestEventUnified<{
      headers: ApiGatewayHeadersMerged<Headers>;
      payload: Payload;
    }>;
    record: never;
  }
> = true;

const VERDICT_SQS_PER_RECORD: SatisfiesInvokeInputSuperset<
  InputOfSqsPerRecord,
  {
    headers: SqsHeadersMerged<Headers>;
    payload: Payload;
    event: SqsEventDecoded<SqsShape>;
    record: never;
  }
> = true;

const VERDICT_SQS_PER_BATCH: SatisfiesInvokeInputSuperset<
  InputOfSqsPerBatch,
  {
    headers: never;
    payload: never;
    event: SqsEventDecoded<SqsShape>;
    record: SqsRecordDecoded<SqsShape>;
  }
> = true;

/**
 * .what = THE RUNTIME HALF. one exhaustive key literal per variant, each forced by
 *         `Record<keyof …, true>` — so a slot added to a variant's contract makes tsc refuse its
 *         literal (TS2741) until the author writes the new word here, and the assertions below
 *         then read it against the superset
 *
 * .why exhaustive literals rather than a read of a live handler's bag = a live read needs an
 *         invoke per variant, and each family's own `[case1]` already does exactly that. this
 *         file's claim is the RELATION between the four, so it reads the four CONTRACTS
 */
const SLOTS_OF_SUPERSET: Record<
  keyof InvokeInputSuperset<{
    headers: unknown;
    payload: unknown;
    event: unknown;
    record: unknown;
  }>,
  true
> = { headers: true, payload: true, event: true, records: true };

const SLOTS_PER_VARIANT: Record<string, Record<string, true>> = {
  forAsk: {
    payload: true,
    event: true,
  } satisfies Record<keyof InputOfAskEndpoint, true>,

  forApiGateway: {
    headers: true,
    payload: true,
    event: true,
  } satisfies Record<keyof InputOfApiGateway, true>,

  'forSqs.perRecord': {
    payload: true,
    headers: true,
    event: true,
  } satisfies Record<keyof InputOfSqsPerRecord, true>,

  'forSqs.perBatch': {
    records: true,
    event: true,
  } satisfies Record<keyof InputOfSqsPerBatch, true>,
};

/**
 * .what = the same read, one level out — the CONFIG bag each variant takes
 * .why = the rule governs terminology across the whole contract, never the `invoke` input
 *        alone. a peer that renamed `logTranslate` to `translateLog`, or `deserialize` to
 *        `parse`, would satisfy every check above and still split the family's vocabulary
 *
 * .why the runtime read alone, with no superset TYPE = the config members are OPTIONAL, and
 *        `keyof` reports an optional key exactly as it reports a required one — so the
 *        exhaustive literal catches a rename and a vanish both, and a superset type would add a
 *        second declaration to keep in sync for no further reach
 *        (`rule.prefer.wet-over-dry`)
 */
const CONFIG_OF_SUPERSET: Record<string, true> = {
  schema: true,
  invoke: true,
  logTranslate: true,
  cors: true,
  deserialize: true,
};

const CONFIG_PER_VARIANT: Record<string, Record<string, true>> = {
  forAsk: {
    schema: true,
    invoke: true,
    logTranslate: true,
  } satisfies Record<
    keyof GenLambdaEndpointInput<AskEvent, { ok: boolean }>,
    true
  >,

  forApiGateway: {
    schema: true,
    invoke: true,
    logTranslate: true,
    cors: true,
    deserialize: true,
  } satisfies Record<keyof ForApiGatewayInput<Headers, Payload, Body>, true>,

  'forSqs.perRecord': {
    schema: true,
    invoke: true,
    logTranslate: true,
    deserialize: true,
  } satisfies Record<keyof ForSqsPerRecordInput<Headers, Payload>, true>,

  'forSqs.perBatch': {
    schema: true,
    invoke: true,
    logTranslate: true,
    deserialize: true,
  } satisfies Record<keyof ForSqsPerBatchInput<Headers, Payload>, true>,
};

describe('the invoke-input superset, across every genLambdaEndpoint variant', () => {
  given('[case1] the four variants the family exposes today', () => {
    when('[t0] each variant is measured against the superset', () => {
      /**
       * .what = the terminology half — divergences forbidden. a variant that names a slot the
       *         superset does not carry fails here, with the word at fault in the diff
       */
      then('every slot a variant carries is a slot the superset names', () => {
        const namesOfSuperset = Object.keys(SLOTS_OF_SUPERSET);
        const divergences = Object.entries(SLOTS_PER_VARIANT).flatMap(
          ([variant, slots]) =>
            Object.keys(slots)
              .filter((slot) => !namesOfSuperset.includes(slot))
              .map((slot) => `${variant}.${slot}`),
        );
        expect(divergences).toEqual([]);
      });

      /**
       * .what = the exclusion half — exclusions allowed. this asserts the extant exclusions by
       *         name, so a slot that vanishes from a variant is as loud as one that appears. a
       *         bare subset check would pass on an empty bag
       */
      then('the extant exclusions are exactly these, and no others', () => {
        const namesOfSuperset = Object.keys(SLOTS_OF_SUPERSET);
        const excluded = Object.fromEntries(
          Object.entries(SLOTS_PER_VARIANT).map(([variant, slots]) => [
            variant,
            namesOfSuperset.filter((slot) => !(slot in slots)).sort(),
          ]),
        );
        expect(excluded).toEqual({
          // a direct invoke carries no metadata bag, and one invoke is one message
          forAsk: ['headers', 'records'],
          // one http request is one message; there is no batch to lift
          forApiGateway: ['records'],
          // one message per invoke, so the pair is singular and there is no list
          'forSqs.perRecord': ['records'],
          // N messages per invoke, so a singular pair would assert a cardinality it lacks
          'forSqs.perBatch': ['headers', 'payload'],
        });
      });

      /**
       * .what = the bite check on the instrument itself. the two `then`s above compare derived
       *         lists, and two empty maps satisfy both — so a contract type that resolved to
       *         `never` would read as a clean pass. this proves the four inputs were read
       *         (`rule.require.positive-control-before-absence-claims`)
       */
      then(
        'the four variants were really read, so neither check is vacuous',
        () => {
          expect(Object.keys(SLOTS_PER_VARIANT).length).toEqual(4);
          expect(
            Object.values(SLOTS_PER_VARIANT).map(
              (slots) => Object.keys(slots).length,
            ),
          ).toEqual([2, 3, 3, 2]);
        },
      );

      /**
       * .what = carries the TYPE gate above into the unit suite, so a reviewer who reads this
       *         file sees it asserted rather than only declared
       * .note = the verdicts are `true` by their TYPE, never by a runtime computation — so this
       *         cannot fail while `--what types` is green, and that is the point: it is the
       *         signpost to the gate, not a second gate
       */
      then('the type gate resolved to a conformant verdict for each', () => {
        expect([
          VERDICT_ASK_ENDPOINT,
          VERDICT_API_GATEWAY,
          VERDICT_SQS_PER_RECORD,
          VERDICT_SQS_PER_BATCH,
        ]).toEqual([true, true, true, true]);
      });
    });

    /**
     * .what = the same two halves, one level out — the config bag
     * .why = the rule governs the whole contract's vocabulary. a peer that renamed
     *        `logTranslate` to `translateLog` would pass every check above and still split the
     *        family's words
     */
    when('[t1] each variant is measured at its CONFIG bag', () => {
      then(
        'every config member a variant takes is one the family names',
        () => {
          const namesOfSuperset = Object.keys(CONFIG_OF_SUPERSET);
          const divergences = Object.entries(CONFIG_PER_VARIANT).flatMap(
            ([variant, members]) =>
              Object.keys(members)
                .filter((member) => !namesOfSuperset.includes(member))
                .map((member) => `${variant}.${member}`),
          );
          expect(divergences).toEqual([]);
        },
      );

      then(
        'the extant config exclusions are exactly these, and no others',
        () => {
          const namesOfSuperset = Object.keys(CONFIG_OF_SUPERSET);
          const excluded = Object.fromEntries(
            Object.entries(CONFIG_PER_VARIANT).map(([variant, members]) => [
              variant,
              namesOfSuperset.filter((member) => !(member in members)).sort(),
            ]),
          );
          expect(excluded).toEqual({
            // the runtime hands it a parsed object, and it answers its caller directly
            forAsk: ['cors', 'deserialize'],
            // the only family whose transport is http
            forApiGateway: [],
            // cors is http's
            'forSqs.perRecord': ['cors'],
            'forSqs.perBatch': ['cors'],
          });
        },
      );

      /**
       * .what = the bite check — `schema` and `invoke` are required on all four, so a read that
       *         saw naught would satisfy both `then`s above with two empty maps
       */
      then('the four config bags were really read', () => {
        expect(
          Object.values(CONFIG_PER_VARIANT).map(
            (members) => Object.keys(members).length,
          ),
        ).toEqual([3, 5, 4, 4]);
      });
    });

    /**
     * .what = the one slot the superset must never name, asserted as an absence
     * .why = `trail` is ambient runtime, so it rides `context.log.trail` and an `input.trail`
     *        slot is forbidden in every family. a superset that named it would make the
     *        forbidden slot legal by construction — the rule inverted by the clamp meant to
     *        hold it (`domain.terms/trail.md`)
     */
    when('[t2] the ambient values are looked for in the request bag', () => {
      then(
        'the superset names no `trail` slot — it is context, never input',
        () => {
          expect(Object.keys(SLOTS_OF_SUPERSET)).not.toContain('trail');
        },
      );
    });
  });

  /**
   * .what = the bite check on the type gate — two synthetic variants that diverge on purpose,
   *         each held by a `@ts-expect-error` that goes TS2578 the day the gate stops to refuse
   *         them
   *
   * .why permanent rather than a one-time probe = a clamp nobody has seen fail is a guess, and a
   *        probe proves it once and leaves no trace. these two arms re-prove it on every
   *        `--what types` run (`rule.require.clamp-edge-cases` — prove the clamp bites)
   *
   * .why synthetic and not an edit to a real variant = a divergence injected into a live
   *        contract is caught by that family's own clamps first, which masks this gate's bite
   *        and teaches a reader the wrong lesson about what caught it. measured: a `FrozenDeep`
   *        dropped from `perRecord.payload` goes red at `perRecord.ts:237` and at its own
   *        `@ts-expect-error`, and never reaches this file
   */
  given('[case2] a variant that diverges from the superset', () => {
    when('[t0] it names a slot the superset does not', () => {
      then('the gate refuses it, and names the excess word', () => {
        // @ts-expect-error — `attributes` is not a slot the superset names
        const verdict: SatisfiesInvokeInputSuperset<
          { event: unknown; attributes: unknown },
          { headers: never; payload: never; event: unknown; record: never }
        > = true;
        expect(verdict).toEqual(true);
      });
    });

    when('[t1] it names the right slot with the wrong shape', () => {
      then('the gate refuses it — a matched word is not a matched type', () => {
        // @ts-expect-error — `payload` carries the wrong value type under the right word
        const verdict: SatisfiesInvokeInputSuperset<
          { payload: { to: number } },
          { headers: never; payload: Payload; event: never; record: never }
        > = true;
        expect(verdict).toEqual(true);
      });
    });

    /**
     * .what = the limit of this gate, asserted rather than assumed — it does not catch a
     *         dropped `FrozenDeep`
     * .why = typescript ignores the `readonly` modifier in assignability, in both directions.
     *        so a variant that hands a mutable slot still satisfies the superset, and a reader
     *        who takes `FrozenDeep` here for a clamp on the freeze is wrong
     * .note = the freeze is held by each variant's own `@ts-expect-error` depth arm
     *         (`rule.require.frozen-invoke-inputs`). this case keeps the limit on the record as
     *         a run rather than as a claim, and it goes red the day typescript starts to
     *         compare `readonly` — the day this gate could take the job over
     */
    /**
     * .what = the SENSE bite check — the exact shape `forAsk` once shipped: `event` bound to the
     *         validated body, with no `payload` slot
     * .why = conditions 1 and 2 passed it, because the gate's caller supplied the body as the
     *        event shape. the word matched and the type matched, and the sense did not. this arm
     *        goes TS2578 the day the gate stops to read what `event` holds
     */
    when('[t3] it binds `event` to the body rather than the envelope', () => {
      then(
        'the gate refuses it — `event` must carry the body, not be it',
        () => {
          // @ts-expect-error — `event` holds the body itself, with no `payload` slot inside it
          const verdict: SatisfiesInvokeInputSuperset<
            { event: { readonly name: string } },
            {
              headers: never;
              payload: never;
              event: { name: string };
              record: never;
            }
          > = true;
          expect(verdict).toEqual(true);
        },
      );
    });

    when(
      '[t4] it lifts a `payload` that is not the body `event` carries',
      () => {
        then(
          'the gate refuses it — the lifted slot is a projection or naught',
          () => {
            // @ts-expect-error — `payload` and `event.payload` hold two different types
            const verdict: SatisfiesInvokeInputSuperset<
              {
                payload: { readonly to: string };
                event: { readonly payload: { readonly from: string } };
              },
              {
                headers: never;
                payload: { to: string };
                event: { payload: { from: string } };
                record: never;
              }
            > = true;
            expect(verdict).toEqual(true);
          },
        );
      },
    );

    when('[t2] it names the right slot but hands it mutable', () => {
      then('the gate lets it pass — the freeze is not clamped here', () => {
        const verdict: SatisfiesInvokeInputSuperset<
          { payload: Payload },
          { headers: never; payload: Payload; event: never; record: never }
        > = true;
        expect(verdict).toEqual(true);
      });
    });
  });
});
