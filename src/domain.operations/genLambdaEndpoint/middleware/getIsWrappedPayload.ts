/**
 * .what = wrapped payload format with event and trail
 * .why = askLambdaEndpoint sends this format for trail propagation
 */
export interface WrappedPayload<TEvent = unknown> {
  event: TEvent;
  trail: { exid?: string };
}

/**
 * .what = checks if trail has valid shape
 * .why = trail must be object (not array) with optional exid string
 */
const isValidTrail = (trail: unknown): trail is { exid?: string } => {
  if (typeof trail !== 'object' || trail === null || Array.isArray(trail))
    return false;
  /**
   * .as = cast from unknown to Record after object checks pass
   * .removal = if typescript gains better type guard inference
   */
  const t = trail as Record<string, unknown>;
  return !('exid' in t) || typeof t.exid === 'string';
};

/**
 * .what = detects if payload is wrapped format { event, trail }
 * .why = wrapped format has exactly two keys: event and trail (valid shape)
 */
export const getIsWrappedPayload = <TEvent = unknown>(
  payload: unknown,
): payload is WrappedPayload<TEvent> => {
  if (typeof payload !== 'object' || payload === null) return false;
  const keys = Object.keys(payload);
  if (keys.length !== 2 || !keys.includes('event') || !keys.includes('trail'))
    return false;
  /**
   * .as = cast after verifying keys 'event' and 'trail' exist
   * .removal = if typescript infers key presence from includes() checks
   */
  const p = payload as { event: unknown; trail: unknown };
  return isValidTrail(p.trail);
};
