/**
 * .what = decodes Uint8Array payload to string
 * .why = pure transformer for lambda response payload decode
 */
export const getDecodedPayload = (input: { payload: Uint8Array }): string => {
  return new TextDecoder().decode(input.payload);
};
