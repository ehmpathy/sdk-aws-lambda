import { EVENT_DECLARED_AS_API_GATEWAY } from './setEventDeclaredAsApiGateway';

/**
 * .what = whether an event carries the api gateway declaration
 * .why = the carrier follows the declaration, never the event's shape
 *        (`invariant.ancient-vs-contemp-callers.md`). an event built by hand, or spread from a
 *        declared one, is undeclared and keeps the `{ event, trail }` wrapper
 */
export const isEventDeclaredAsApiGateway = (input: {
  event: unknown;
}): boolean =>
  typeof input.event === 'object' &&
  input.event !== null &&
  Reflect.get(input.event, EVENT_DECLARED_AS_API_GATEWAY) === true;
