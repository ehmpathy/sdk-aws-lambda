/**
 * .what = where a family's caller puts its trail and its contemp opt-in
 * .why = one opt-in per transport (`invariant.ancient-vs-contemp-callers.md`)
 *
 * | carrier | the caller's trail + opt-in ride | families |
 * |---------|----------------------------------|----------|
 * | `wrapper` | `{ event, trail }` — a direct invoke owns its whole payload and has no metadata bag | `forAsk`, `forSqs.*` |
 * | `headers` | the envelope's own `headers` — aws builds that envelope, so no caller can wrap it | `forApiGateway` |
 * | `none` | nowhere — aws builds the envelope, and no carrier in it is lifted yet | `forSns`, `forKinesis.*` |
 *
 * .note = `none` reads no trail and no opt-in, so each invoke mints a fresh `exid`, and the runner hands
 *         the event untouched in every dialect. a kinesis record carries no metadata bag at all; sns
 *         carries `MessageAttributes`, whose lift is unbuilt (`domain.terms/trail.md`). a `{ event, trail }`
 *         wrapper is never honored at an aws-delivered family it was not already named for
 *         (`invariant.ancient-vs-contemp-callers.md`)
 *
 * .note = it lives here because two peer operations name it — the endpoint that reads the
 *         carrier (`genTrailMiddleware`) and the runner that writes it (`runLambdaEndpoint`)
 *         (rule.prefer.most-common-denominator)
 * .note = `forSqs.*` reads the wrapper a test runner frames, as it did before the headers carrier
 *         existed. aws never sends one to an sqs handler, so a deployed sqs endpoint reads no trail;
 *         the `messageAttributes` lift is recorded as next (`domain.terms/trail.md`)
 */
export const TRAIL_CARRIERS = ['wrapper', 'headers', 'none'] as const;

/**
 * .what = one of the carriers above
 * .why = derived from the tuple, so a reader of an unknown stamp checks against the one list and a
 *        new carrier needs no second edit there
 */
export type TrailCarrier = (typeof TRAIL_CARRIERS)[number];
