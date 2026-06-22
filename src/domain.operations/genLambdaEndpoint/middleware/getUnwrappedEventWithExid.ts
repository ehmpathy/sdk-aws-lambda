import {
  getIsWrappedPayload,
  type WrappedPayload,
} from './getIsWrappedPayload';

/**
 * .what = extracts exid and unwrapped event from payload, detects caller version
 * .why = handlers accept wrapped (with trail) or raw (without trail) payloads
 *        isContempCaller enables version-appropriate error responses
 */
export const getUnwrappedEventWithExid = <TEvent>(input: {
  payload: TEvent | WrappedPayload<TEvent>;
}): {
  exidFromPayload: string | null;
  unwrappedEvent: TEvent;
  isContempCaller: boolean;
} => {
  if (getIsWrappedPayload(input.payload)) {
    return {
      exidFromPayload: input.payload.trail?.exid ?? null,
      unwrappedEvent: input.payload.event,
      isContempCaller: true,
    };
  }
  return {
    exidFromPayload: null,
    unwrappedEvent: input.payload,
    isContempCaller: false,
  };
};
