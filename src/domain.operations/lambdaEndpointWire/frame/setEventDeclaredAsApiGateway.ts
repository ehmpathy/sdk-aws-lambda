/**
 * .what = the mark `asLambdaEvent.fromApiGateway` leaves on an event it built
 * .why = `runLambdaEndpoint` must pick the carrier — header or wrapper — and the sdk never sniffs an
 *        event's shape for it (`invariant.ancient-vs-contemp-callers.md`). the builder knows what it
 *        built, so it declares it
 *
 * .note = `Symbol.for`, so two copies of this package in one process still agree on the mark
 */
export const EVENT_DECLARED_AS_API_GATEWAY = Symbol.for(
  'sdk-aws-lambda.event.declaredAs.apiGateway',
);

/**
 * .what = declares an event as an api gateway event, and returns the same event
 * .why = the declaration travels WITH the event object, so a test author's event reaches
 *        `runLambdaEndpoint` still declared
 *
 * .note = non-enumerable, so it appears in no spread, no snapshot, no `toEqual`, and no json —
 *         `runLambdaEndpoint` reads it BEFORE its json strip, which would drop it
 * .note = DELIBERATE MUTATION — of the fresh object the builder just made, never of a caller's
 */
export const setEventDeclaredAsApiGateway = <TEvent extends object>(input: {
  event: TEvent;
}): TEvent =>
  Object.defineProperty(input.event, EVENT_DECLARED_AS_API_GATEWAY, {
    value: true,
    enumerable: false,
  });
