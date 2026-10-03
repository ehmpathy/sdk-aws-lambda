import type { FrozenDeep } from 'type-fns';

/**
 * .what = the shapes one family binds into the superset — its own types, per slot
 * .why = the superset must be checkable against a variant that carries real types, never against
 *        `unknown`. a superset of `unknown` slots accepts every shape, so it would clamp the
 *        names and let the shapes diverge — half the rule, read as all of it
 *        (`rule.require.measure-the-value-you-emit`)
 *
 * .note = a family binds `never` for a slot it excludes. the excluded slot is then unreachable
 *         rather than merely absent, so a later author who lifts it cannot bind a shape by
 *         accident and must state one
 */
export interface InvokeShapes {
  /** the metadata bag the transport carried beside the body */
  headers: unknown;
  /** the body, parsed and validated */
  payload: unknown;
  /** the whole object that arrived */
  event: unknown;
  /** one message of a batch, for a family whose trigger delivers many */
  record: unknown;
}

/**
 * .what = the superset every `genLambdaEndpoint.for*` variant's `invoke` input is a subset of
 * .why = one family, one vocabulary. a variant may carry fewer slots than this names; it may
 *        never carry a slot this does not name, nor the same slot under a different shape
 *        (`rule.require.consistent-variant-contracts`)
 *
 * .why a superset and not a base type every variant extends = a variant that extends a base
 *        inherits every slot, so an exclusion becomes unexpressible and each family would owe a
 *        `never`-typed slot it does not have. the subset direction is what makes "exclusions
 *        allowed" and "divergences forbidden" one rule rather than two
 *
 * .note = `trail` is absent, deliberately and permanently. the lineage is ambient, so it rides
 *         `context.log.trail` — an `input.trail` slot is forbidden in every family, so the
 *         superset must not name one (`domain.terms/trail.md`)
 *
 * .note = every slot is `FrozenDeep`, because every value handed to an `invoke` is deep-frozen
 *         in every family (`rule.require.frozen-invoke-inputs`)
 * .note = the freeze is NOT clampable from here, measured. per arm of `FrozenDeep`:
 *         - an object property: typescript ignores `readonly` in assignability, in both
 *           directions — `{ to: string }` is assignable to `{ readonly to: string }` and back
 *         - an array, `Set`, or `Map`: the mutable form is assignable to its readonly peer
 *           (`string[]` → `readonly string[]`); only the reverse fails
 *         either way, a mutable slot satisfies a frozen one. so a variant that drops `FrozenDeep`
 *         from a slot still satisfies this superset, and a bite check written for it goes TS2578
 *         rather than red. each arm is run in `InvokeInputSuperset.test.ts [case2][t2]`. the freeze is held by each variant's
 *         own `@ts-expect-error` depth arm instead; this superset clamps a slot's NAME and its
 *         VALUE TYPE, and naught else
 */
export type InvokeInputSuperset<TShapes extends InvokeShapes> = {
  /** the metadata bag — lowercased at http, verbatim at sqs; the case is the transport's */
  headers: FrozenDeep<TShapes['headers']>;
  /** the body, parsed and validated against `schema.input`'s `payload` half */
  payload: FrozenDeep<TShapes['payload']>;
  /** the whole object that arrived — the one slot every family carries */
  event: FrozenDeep<TShapes['event']>;
  /** the messages that passed validation, for a batch-grained family */
  records: FrozenDeep<TShapes['record'][]>;
};

/**
 * .what = the shape `event` must hold in every family — an envelope that CARRIES the body
 * .why = `event` means the whole object that arrived, and the body is one slot of it: at
 *        `event.payload` for a family with one message, at `event.records[i].payload` for a
 *        family with many (`domain.terms/event.md`). a value with neither is the body itself
 *        under the envelope's name, which is the one-word-two-senses defect the rule forbids
 */
export type InvokeEventEnvelope =
  | { readonly payload: unknown }
  | { readonly records: readonly { readonly payload: unknown }[] };

/**
 * .what = the body an envelope carries — the single message's, or one record's
 */
type BodyOfEnvelope<TEvent> = TEvent extends { readonly payload: infer P }
  ? P
  : TEvent extends { readonly records: readonly (infer R)[] }
    ? R extends { readonly payload: infer P }
      ? P
      : never
    : never;

/**
 * .what = the SENSE half of the verdict: `event` is an envelope, and a lifted `payload` is its body
 * .why = conditions 1 and 2 compare a variant against shapes the caller of the gate SUPPLIES, so
 *        a variant that bound `event` to its body passed them both — the caller simply supplied the
 *        body as the event shape. this condition reads the contract's own input and needs no
 *        supplied shape, so it cannot be satisfied by a wrong bind
 */
type SatisfiesInvokeInputSense<TInput> = 'event' extends keyof TInput
  ? TInput['event' & keyof TInput] extends InvokeEventEnvelope
    ? 'payload' extends keyof TInput
      ? [TInput['payload' & keyof TInput]] extends [
          BodyOfEnvelope<TInput['event' & keyof TInput]>,
        ]
        ? true
        : {
            ERROR: 'the lifted `payload` is not the body `event` carries — lift `event.payload` (or that of one of `event.records`), never a second value';
            got: TInput['payload' & keyof TInput];
            want: BodyOfEnvelope<TInput['event' & keyof TInput]>;
          }
      : true
    : {
        ERROR: '`event` DIVERGES in sense — it must be the whole object that arrived, with the body at `event.payload` or `event.records[i].payload`. hand the body as `payload`';
        got: TInput['event' & keyof TInput];
      }
  : true;

/**
 * .what = the compile-time verdict on one variant: is its `invoke` input a subset of the
 *         superset, in name, shape, and sense?
 * .why = it resolves to `true` when the variant conforms and to a named error object when it does
 *        not — so the failure reads as the sentence the rule states rather than as a bare
 *        `TS2322: 'false' is not assignable to 'true'` (`rule.require.errors-name-the-fix`)
 *
 * .how = three conditions, in the order a reader should check them:
 *          1. terminology — every key it carries is a key the superset names
 *          2. shape — its value at each shared key is the superset's value at that key
 *          3. sense — `event` is an envelope that carries the body, and a lifted `payload` is
 *             that body (`SatisfiesInvokeInputSense`)
 *
 * .note = condition 2 is checked over `keyof TInput` alone, never over the whole superset. that
 *         is what makes an exclusion legal: a slot the variant omits is never compared
 * .note = condition 3 cannot tell a body that happens to hold a `payload` key from an envelope.
 *         the per-family `payload === event.payload` identity cases close that at runtime
 */
export type SatisfiesInvokeInputSuperset<
  TInput,
  TShapes extends InvokeShapes,
> = keyof TInput extends keyof InvokeInputSuperset<TShapes>
  ? TInput extends Pick<
      InvokeInputSuperset<TShapes>,
      keyof TInput & keyof InvokeInputSuperset<TShapes>
    >
    ? SatisfiesInvokeInputSense<TInput>
    : {
        ERROR: 'a slot DIVERGES in shape from the superset — rename it, or correct its type';
        got: TInput;
        want: Pick<
          InvokeInputSuperset<TShapes>,
          keyof TInput & keyof InvokeInputSuperset<TShapes>
        >;
      }
  : {
      ERROR: 'a slot DIVERGES in name — the superset does not name it. add it there, or reuse the extant word';
      excess: Exclude<keyof TInput, keyof InvokeInputSuperset<TShapes>>;
    };
