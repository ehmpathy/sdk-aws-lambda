/**
 * .what = where a family's caller puts its trail and its contemp opt-in
 * .why = one opt-in per transport (`invariant.ancient-vs-contemp-callers.md`)
 *
 * | carrier | the caller's trail + opt-in ride | families |
 * |---------|----------------------------------|----------|
 * | `wrapper` | `{ event, trail }` — a direct invoke owns its whole payload and has no metadata bag | `forAsk`, `forSqs.*` |
 * | `headers` | the envelope's own `headers` — aws builds that envelope, so no caller can wrap it | `forApiGateway` |
 *
 * .note = it lives here because two peer operations name it — the endpoint that reads the
 *         carrier (`genTrailMiddleware`) and the runner that writes it (`runLambdaEndpoint`)
 *         (rule.prefer.most-common-denominator)
 * .note = `forSqs.*` reads the wrapper a test runner frames, as it did before the headers carrier
 *         existed. aws never sends one to an sqs handler, so a deployed sqs endpoint reads no trail;
 *         the `messageAttributes` lift is recorded as next (`domain.terms/trail.md`)
 */
export type TrailCarrier = 'wrapper' | 'headers';
