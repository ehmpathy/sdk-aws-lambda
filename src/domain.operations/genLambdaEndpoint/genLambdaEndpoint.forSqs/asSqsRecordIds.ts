/**
 * .what = the set of ids a list of sqs records carries
 * .why = `perBatch` reads "which ids may a handler claim" off the validated records, and a set is
 *        the shape every later membership check wants
 */
export const asSqsRecordIds = (input: {
  records: ReadonlyArray<{ id: string }>;
}): Set<string> => new Set(input.records.map((record) => record.id));
