import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';
import type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from '../../../domain.objects/LambdaEndpointErrorResponseBody';

/**
 * .what = the constraint envelope a given dialect returns
 * .why = puts the envelope SHAPE in the return type, so a cross-dialect field
 *   access does not compile — rung 1 of rule.prefer.prevent-over-correct, where a
 *   runtime reader would be rung 4.
 *
 * 🔴 the BARE `TDialect extends` form is deliberate: it DISTRIBUTES, so
 *    `…Envelope<LambdaEndpointDialect>` resolves to `Ancient | Contemp` and
 *    `asLambdaEndpointOutput`'s `Exclude` subtracts BOTH arms. wrap either side in
 *    a tuple — the usual non-distributive idiom — and it subtracts contemp only,
 *    so an ancient run's success narrow still holds the envelope.
 *
 *    ⚠️ no runtime test can see that; the predicate reads the VALUE, so the break
 *      is purely ergonomic and surfaces first at a consumer's type gate. clamped
 *      in `LambdaEndpointRunOutput.test.ts`.
 */
export type LambdaEndpointErrorEnvelope<
  TDialect extends LambdaEndpointDialect,
> = TDialect extends 'ancient'
  ? LambdaEndpointErrorResponseBodyAncient
  : LambdaEndpointErrorResponseBodyContemp;

/**
 * .what = the type a value HAS after it crosses the json wire
 * .why = the util json-strips what a handler returns, so `{ scheduledAt: Date }`
 *   yields a `string`. without this type the run output carries the HANDLER's
 *   declaration and `out.scheduledAt.toISOString()` compiles, then throws — an
 *   unsound public type is the compile-time twin of rule.forbid.failhide.
 *
 * ⚠️ .the BOUND = it models `Date` → iso string, and recurses arrays + objects.
 *   it does NOT model the two key-DROP cases (a required key valued `undefined`,
 *   a function value), because both need a key-remap that turns the type into an
 *   intersection — which then renders in every consumer's error messages.
 */
export type WireStripped<T> = T extends Date
  ? string
  : T extends (infer TItem)[]
    ? WireStripped<TItem>[]
    : T extends object
      ? { [K in keyof T]: WireStripped<T[K]> }
      : T;

/**
 * .what = the type a value HAS after aws DELIVERS it — the wire strip, plus the
 *         one divergence a wire has that an in-process strip does not
 * .why = 🔴 the two boundaries disagree about a VOID handler, and both are right.
 *   `onReferenced` is HOST-faithful and answers `undefined` (what the function
 *   returned); `onSerialized` is WIRE-faithful and answers `null` (what aws
 *   delivers). so one type cannot serve both, and this is the serialized half.
 *
 * 🔴 not an edge case — it is the sqs and sns consumer shape, so a migrant who
 *    tests one handler on both boundaries meets it on their first pair of tests.
 *
 * .note = the TUPLE form is deliberate. a bare `T extends void` distributes, so
 *   `void | { found }` would map arm-by-arm to `null | { found }` where the wire
 *   delivers one or the other. `[T] extends [void]` asks of the whole type.
 */
export type WireDelivered<T> = [T] extends [void] ? null : WireStripped<T>;

/**
 * .what = what a run of an endpoint answers: the output, or the constraint envelope
 * .why = a constraint error is RETURNED on the referenced boundary — the lambda
 *   succeeded, it just told the caller their request was invalid
 *   (invariant.badrequesterror-not-lambda-error). so the union is the honest
 *   return type, and a test that expects only `TOutput` gets a compile error.
 *
 * .note = why these live in the operation rather than `domain.objects/` — and the
 *   answer differs per type, so a blanket lift would be wrong:
 *
 *   | type | why here |
 *   |---|---|
 *   | `WireStripped` / `WireDelivered` | type-level MAPPERS over one boundary's lossiness. not nouns the domain holds |
 *   | `LambdaEndpointRunOutput` | an operation's RETURN CONTRACT (rule.forbid.io-as-domain-objects) |
 *   | `LambdaEndpointErrorEnvelope` | 🟡 the one real candidate. its only consumers are the lines below it, so a lift buys naught |
 */
export type LambdaEndpointRunOutput<
  TOutput,
  TDialect extends LambdaEndpointDialect,
> = WireStripped<TOutput> | LambdaEndpointErrorEnvelope<TDialect>;
