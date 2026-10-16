/**
 * .what = reads the `correlationId` an endpoint's redacted 500 body holds, or null when it holds none
 * .why = the 500 body is family-blind: `{ errorMessage, errorType, correlationId }`. the id is the key to
 *        the real error in the endpoint's logs, so the thrown `MalfunctionError` carries it
 *
 * .note = reads one string field off a body of unknown shape, so the shape is checked here, in one
 *         named place, rather than at each reader
 */
export const getOneCorrelationIdFromBody = (input: {
  body: unknown;
}): string | null => {
  if (typeof input.body !== 'object' || input.body === null) return null;
  const correlationId = Reflect.get(input.body, 'correlationId');
  return typeof correlationId === 'string' ? correlationId : null;
};
