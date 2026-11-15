/**
 * .what = the set of ids a list of records carries
 * .why = a per-batch variant reads "which ids may a handler claim" off the validated records, and a set is
 *        the shape every later membership check wants
 */
export const asRecordIds = (input: {
  records: ReadonlyArray<{ id: string }>;
}): Set<string> => new Set(input.records.map((record) => record.id));
