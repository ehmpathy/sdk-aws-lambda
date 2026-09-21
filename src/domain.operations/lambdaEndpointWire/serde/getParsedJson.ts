/**
 * .what = result of json parse attempt
 * .why = represents either success or failure without throw
 */
export type ParsedJsonResult =
  | { success: true; data: unknown }
  | { success: false; error: SyntaxError };

/**
 * .what = parse json string without throw
 * .why = pure transformer returns result union instead of throw
 */
export const getParsedJson = (input: { json: string }): ParsedJsonResult => {
  try {
    const data = JSON.parse(input.json);
    return { success: true, data };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error };
    }
    // non-SyntaxError is unexpected, rethrow
    throw error;
  }
};
