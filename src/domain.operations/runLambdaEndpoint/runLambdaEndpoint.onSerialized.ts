import { ConstraintError } from 'helpful-errors';

import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import type { LambdaEndpointDialect } from '../../domain.objects/LambdaEndpointDialect';
import { askLambdaEndpoint } from '../askLambdaEndpoint/askLambdaEndpoint';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { getOneTrailExid } from '../lambdaEndpointWire/context/getOneTrailExid';
import { throwIfCredentialsError } from '../lambdaEndpointWire/error/throwIfCredentialsError';
import { getParsedResponse } from '../lambdaEndpointWire/getParsedResponse';
import { asLambdaEndpointDialect } from './dialect/asLambdaEndpointDialect';
import type { WireDelivered } from './dialect/LambdaEndpointRunOutput';
import { assertEventIsGiven } from './guard/assertEventIsGiven';
import { assertHandlerIsRunnable } from './guard/assertHandlerIsRunnable';
import { asLocalRunIdentity } from './local/asLocalRunIdentity';
import { getOneHandlerFromServerlessYml } from './local/getOneHandlerFromServerlessYml';
import { onReferenced } from './runLambdaEndpoint.onReferenced';
import { asWireFunctionErrorPayload } from './serde/asWireFunctionErrorPayload';
import { asWirePayload } from './serde/asWirePayload';

/**
 * .what = where the endpoint runs, once you address it by slug
 * .why = a slug points either at the real wire or at this repo's own
 *        serverless.yml. both cross the SERIALIZED boundary, so both take caller
 *        semantics — the locus changes where, never what
 *        (define.lambda-endpoint-run-boundary)
 */
export type LambdaEndpointLocus = 'cloud' | 'local';

/**
 * .what = runs a lambda endpoint you hold the SLUG of — `{ service, function }`
 *         plus the ambient access
 * .why = shapes cross this boundary as json, so you are the endpoint's CALLER
 *        rather than its host — and a caller gets caller semantics
 *
 * ## 🔴 the error stance INVERTS, and that is the whole reason for the split
 *
 * | boundary | a constraint error arrives as | because |
 * |----------|-------------------------------|---------|
 * | `onReferenced` | a **returned** envelope | you hold the handler, so you are the HOST |
 * | `onSerialized` | a **thrown** `ConstraintError` | you named the endpoint, so you are a CALLER |
 *
 * ⚠️ `at` does NOT cleave this — `'local'` and `'cloud'` both throw. a constraint
 *    fault is RETURNED by the handler and reaches the shared hydration by itself;
 *    a malfunction is THROWN, so `asWireFunctionErrorPayload` casts it into the
 *    payload aws would have sent. one hydration, both loci, both outcome families.
 *
 * ⚠️ the type does not catch a move across the boundary — a rejected `Promise<T>`
 *    is well-typed, so an author who comes from `onReferenced` and still expects a
 *    returned envelope gets a runtime surprise. the subdomain names are the cue.
 *
 * ## the two loci cannot drift
 *
 * `'local'` runs the handler in-process, then hands its output through the SAME
 * hydration the wire uses (`getParsedResponse`). one hydration, not two.
 *
 * ## 🔴 what the move off the incumbent buys
 *
 * the incumbent reaches aws through `simple-lambda-client`, which pulls aws-sdk v2
 * — no sso-profile support, so it hangs on IMDS. measured at **90s per invoke** on
 * `ahbode/svc-home-services` PR #30 until credentials were exported to env vars.
 * this sdk is on `@aws-sdk/client-lambda` v3, which reads an sso profile natively.
 *
 * @example
 * ```ts
 * // the deployed function, over the real wire
 * const out = await runLambdaEndpoint.onSerialized(
 *   { which: { service: 'svc-home-services', function: 'getServiceBySlug' },
 *     event: { slug: 'surf-lesson' }, at: 'cloud' },
 *   { log, env: { access: 'prep' } },
 * );
 *
 * // the same endpoint, run from this repo's serverless.yml
 * const out = await runLambdaEndpoint.onSerialized({ …, at: 'local' }, { log, env });
 *
 * // a caller fault THROWS here, on either locus
 * await expect(
 *   runLambdaEndpoint.onSerialized({ …, event: { slug: '' } }, ctx),
 * ).rejects.toThrow(ConstraintError);
 * ```
 */
export const onSerialized = async <TEvent, TOutput>(
  input: {
    /**
     * the endpoint's business identity. the ambient `context.env.access`
     * completes the slug (rule.require.env-access-in-context).
     */
    which: { service: string; function: string };

    /**
     * the event to send
     */
    event: TEvent;

    /**
     * where the slug is looked up. cloud by default — the deployed function.
     */
    at?: LambdaEndpointLocus;

    /**
     * which error dialect to send in. contemp by default.
     *
     * 🔴 .note = a plain input here, NEVER a type parameter — unlike
     *   `onReferenced<…, TDialect>`. a type-level dialect needs an envelope in the
     *   return to guard, and this boundary has none: a caller fault is THROWN, and
     *   both dialects hydrate to the same error. so the dialect changes what goes
     *   over the WIRE and no shape the author can read; a `TDialect` here would
     *   advertise a guarantee with no arm to guard.
     */
    struct?: { payload: LambdaEndpointDialect };

    /**
     * where to search for serverless.yml, when `at: 'local'`. cwd by default.
     */
    from?: string;
  },
  context: ContextAwsLambdaCaller,
): Promise<WireDelivered<TOutput>> => {
  // an ABSENT event is refused HERE TOO, before the locus branch — the referenced
  // twin's guard would answer the cloud locus 90s late and the local locus
  // stripped of its hint. both halves measured; see `guard/assertEventIsGiven.ts`.
  assertEventIsGiven({
    event: input.event,
    metadata: { which: input.which, at: input.at ?? 'cloud' },
  });

  const at = input.at ?? 'cloud';

  // 🔴 an UNKNOWN locus is refused. the branch below reads `if (at === 'cloud')`
  //    and lets every other value fall to LOCAL, so `'CLOUD'` or an `at` read
  //    from config runs in-process while the caller believes they hit a deployed
  //    lambda — and a fall to local LOOKS LIKE A PASS where a fall to cloud
  //    would fail loud (`rule.forbid.unexpected-defaults`).
  if (at !== 'cloud' && at !== 'local')
    return ConstraintError.throw(
      'the locus given is not one this util can run',
      {
        at,
        options: ['cloud', 'local'],
        hint: "pass `at: 'cloud'` to invoke the deployed lambda over the wire, or `at: 'local'` to resolve the handler from serverless.yml and run it in-process. omit `at` for the 'cloud' default.",
      },
    );

  // 🔴 an UNKNOWN dialect is refused HERE, before either locus forwards it — the
  //    CLOUD half is what needs it, since local would be caught downstream. the
  //    result is BOUND and forwarded rather than discarded, so a delete of this
  //    line fails the build (`rule.prefer.prevent-over-correct`, rung 1).
  const dialectValidated = asLambdaEndpointDialect({
    declared: input.struct?.payload,
  });
  const structValidated = { payload: dialectValidated };

  // the cloud locus: the real wire, with v3 credentials and the sdk's own serde.
  // the type argument is `WireDelivered<TOutput>`, never `TOutput` — it names
  // the shape to PARSE OUT OF the wire payload.
  //
  // 🔴 the credentials fault is named HERE and deliberately NOT on
  //    `askLambdaEndpoint`. same aws error, opposite diagnosis:
  //
  //    | boundary | who meets it | an absent credential is |
  //    |---|---|---|
  //    | `onSerialized({ at: 'cloud' })` | a developer, at a terminal | an expired sso session — one command away |
  //    | `askLambdaEndpoint` | a deployed lambda, in prod | a broken execution role — a server fault |
  //
  //    `LambdaCredentialsAbsentError extends ConstraintError` ⇒ caller fault, NO
  //    ALARM. to map it on the runtime path would suppress the prod alarm that
  //    names a broken role (`invariant.badrequesterror-not-lambda-error`).
  if (at === 'cloud')
    return askLambdaEndpoint<TEvent, WireDelivered<TOutput>>(
      {
        which: input.which,
        event: input.event,
        struct: structValidated,
      },
      context,
    ).catch((error: unknown) =>
      throwIfCredentialsError({
        error,
        message:
          'aws credentials are absent or expired, so the deployed endpoint cannot be invoked',
        access: context.env.access,
        metadata: {
          which: input.which,
          access: context.env.access,
          at,
        },
      }),
    );

  // the local locus: look the handler up, run it, then hydrate exactly as the wire does
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  const handler = await getOneHandlerFromServerlessYml({
    service: input.which.service,
    function: input.which.function,
    from: input.from,
  });

  // 🔴 the handler guards run HERE, ahead of the delegation — the placement IS
  //    the repair (see `serde/asWireFunctionErrorPayload.ts`). clamped at two
  //    grains, since the integration clamp imports an INTERNAL path and a barrel
  //    that re-caught on the way out would leave it green.
  assertHandlerIsRunnable({ handler });

  // the exid AND its fallback report, in one call — the same call the cloud
  // locus makes, so the two loci cannot diverge on this diagnostic
  const exid = getOneTrailExid({ log: context.log });

  // reuse the referenced boundary to run it — the serialized-local cell is BUILT
  // on the referenced cell, as the incumbent composes it
  // (invokeLambdaForTestingLocally.ts:81).
  // ⚠️ the `.catch` casts a THROW into the payload aws would have put on the
  //    wire, so it reaches the shared hydration below as the cloud locus does.
  const output = await onReferenced({
    event: input.event,
    handler,
    struct: structValidated,

    // the runtime identity is DERIVED from the endpoint, never a caller's knob —
    // see `asLocalRunIdentity` for why a `context` passthrough is declined here
    context: asLocalRunIdentity({ endpoint, region: context.env.region }),

    // 🟡 the trail, forwarded. omit it and the endpoint's trail middleware
    //    generates a fresh exid, so the caller's trace does not join up — and no
    //    test fails, because an absent trail is legal
    //    (`invariant.payload-format-compat`). it does NOT select the dialect.
    trail: { exid },
  }).catch(asWireFunctionErrorPayload);

  // 🔴 one hydration, shared with the wire — so the two loci cannot disagree
  //    about what an envelope means. `asWirePayload` carries the one place they
  //    DO diverge (a void handler's value) and states why.
  return getParsedResponse<WireDelivered<TOutput>>({
    payload: asWirePayload(output),
    functionError: undefined,
    endpoint,
    exid,
  });
};
