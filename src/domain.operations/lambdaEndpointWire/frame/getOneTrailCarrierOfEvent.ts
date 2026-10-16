import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';
import { isEventDeclaredAsApiGateway } from './isEventDeclaredAsApiGateway';

/**
 * .what = which carrier an event's caller must put its trail and contemp opt-in in
 * .why = an event the builder declared as api gateway is built by aws in prod, so no caller can wrap
 *        it; its opt-in rides the request's `headers`. every other event keeps the `{ event, trail }`
 *        wrapper (`invariant.ancient-vs-contemp-callers.md`)
 *
 * .note = the declaration is the builder's alone. an event's own contents never choose its carrier:
 *         an event cannot know which family receives it, and a forwarded request that happens to hold
 *         an `x-trail-exid` header is a valid payload for a direct invoke
 * .note = this is the fallback. where the runner holds the handler (`onReferenced`, and the local locus
 *         of `onSerialized`) the handler's own declaration decides first (`getOneTrailCarrierOfHandler`),
 *         so a copy of a built event is framed for the family that receives it. the event's mark is the
 *         only declaration at the cloud locus, which holds no handler
 * .note = both run boundaries (`onReferenced`, and `onSerialized` at cloud) pick the carrier here, so
 *         the two cannot disagree. read it BEFORE the json strip, which drops the declaration
 */
export const getOneTrailCarrierOfEvent = (input: {
  event: unknown;
}): TrailCarrier =>
  isEventDeclaredAsApiGateway({ event: input.event }) ? 'headers' : 'wrapper';
