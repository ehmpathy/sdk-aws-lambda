import { types } from 'node:util';

/**
 * .what = the wire label of any thrown value, as the aws node runtime writes it
 * .why = a local run must label a throw exactly as the cloud does, or a caller fault flips side
 *        between loci. the source is `toRapidResponse` in
 *        `aws-lambda-nodejs-runtime-interface-client`, `src/Errors.js`:
 *
 *        ```js
 *        try {
 *          if (util.types.isNativeError(error) || _isError(error))
 *            return { errorType: error.name?.replaceAll('\x7F', '%7F'), ...,
 *                     trace: error.stack.replaceAll('\x7F', '%7F').split('\n') };
 *          return { errorType: typeof error, errorMessage: error.toString(), trace: [] };
 *        } catch (_err) { return { errorType: 'handled', ... }; }
 *        ```
 *
 *        `_isError` asks for a truthy `name`, `message`, and `stack`, each a string
 *
 * .note = read from `aws/aws-lambda-nodejs-runtime-interface-client` `main`, `src/Errors.js`, on
 *         2026-10-22. `blackbox/deployed.faultLabel.acceptance.test.ts` compares it to the
 *         deployed runtime, one fault kind per branch, so a label rule change upstream turns that
 *         suite red. a branch no kind there reaches is still caught only by a re-read of the file
 *
 * .note = a thrown `null` or `undefined` never reaches `toRapidResponse` on the cloud: the
 *         runtime's `CallbackContext.fail` swaps it for the string `'handled'` first. this
 *         mirrors `toRapidResponse` alone; `asWireFunctionErrorPayload` makes that swap ahead of it
 *
 * .note = each branch the runtime reaches via its `catch` is computed here up front, so this
 *         holds no catch of its own: an error-shaped value whose `stack`, or a present `name` or
 *         `message`, is not a string makes the runtime's `.replaceAll` throw; a `null`, an
 *         `undefined`, a value with no `toString`, or one whose `toString` (or its getter)
 *         throws makes `error.toString()` throw. each of those reads `'handled'`
 * .note = one divergence, by type: a native error whose `.name` was set nullish gets no
 *         `errorType` on the cloud; this answers `'undefined'`, since a label is a string
 * .note = two predicates, two questions. `isErrorLike` is the COARSE narrow: "can I read
 *         `.message` and `.stack` off this?". this is the runtime's LABEL rule: "what does the
 *         cloud call it?". a site that reads fields reaches for `isErrorLike`; a site that must
 *         match the wire label reaches for this
 */
export const asErrorTypeOfErrorLike = (input: { error: unknown }): string => {
  const error = input.error;

  // the runtime's error arm: a native error, or a value its `_isError` accepts
  if (types.isNativeError(error) || isRuntimeErrorShape(error))
    return asErrorTypeOfErrorShaped({ error });

  // the runtime's other arm calls `error.toString()`; where that throws, it answers 'handled'
  if (!isToStringCallable({ value: error })) return 'handled';
  return typeof error;
};

/**
 * .what = the runtime's `_isError`: a truthy `name`, `message`, and `stack`, each a string
 * .why = the empty string is falsy, so `{ name: 'X', message: '', stack: 's' }` fails it
 * .note = `_isError` asks no `typeof` of the value, so a named function with a string
 *         `message` and `stack` passes it too, and the cloud labels it by its `.name`
 */
const isRuntimeErrorShape = (value: unknown): value is object =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  'name' in value &&
  'message' in value &&
  'stack' in value &&
  typeof value.name === 'string' &&
  typeof value.message === 'string' &&
  typeof value.stack === 'string' &&
  value.name !== '' &&
  value.message !== '' &&
  value.stack !== '';

/**
 * .what = the label of a value the runtime treats as an error: its `.name`, or 'handled' where
 *         the runtime's own reads would throw
 */
const asErrorTypeOfErrorShaped = (input: { error: object }): string => {
  // a native error or a `_isError` value; each read may be absent on either
  const name: unknown = Reflect.get(input.error, 'name');
  const message: unknown = Reflect.get(input.error, 'message');
  const stack: unknown = Reflect.get(input.error, 'stack');

  // `error.stack.replaceAll(...)` throws on a stack that is not a string
  if (typeof stack !== 'string') return 'handled';

  // `?.replaceAll(...)` throws on a present name or message that is not a string
  const isStringOrNullish = (value: unknown): boolean =>
    value === null || value === undefined || typeof value === 'string';
  if (!isStringOrNullish(name) || !isStringOrNullish(message)) return 'handled';

  // the runtime escapes DEL, so a label that holds one reads the same on both loci
  return typeof name === 'string'
    ? name.split('\x7F').join('%7F')
    : 'undefined';
};

/**
 * .what = whether `value.toString()` runs, as the runtime's non-error arm calls it
 * .why = the runtime answers 'handled' wherever that call throws: an absent `toString` (a null
 *        prototype), one that throws, or a getter that throws. only a call tells all three apart,
 *        so the probe calls it rather than read the property
 * .note = the catch IS the mirror of the runtime's own `catch`, never a hidden fault: whatever
 *         the call throws, the cloud reads 'handled', and so does this. a `toString` with side
 *         effects runs once here and once more where the payload writes the message
 */
const isToStringCallable = (input: { value: unknown }): boolean => {
  if (input.value === null || input.value === undefined) return false;
  try {
    // a primitive boxes to its prototype's `toString`, so `Object()` reads it the same way
    const toStringFound: unknown = Reflect.get(Object(input.value), 'toString');
    if (typeof toStringFound !== 'function') return false;
    Reflect.apply(toStringFound, input.value, []);
    return true;
  } catch {
    return false;
  }
};
