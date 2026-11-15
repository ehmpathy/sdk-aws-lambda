/**
 * .what = the ids a batched source must retry: every delivered record neither claimed as a success
 *         nor refused
 * .why = fail safe by construction — a record the handler did not vouch for is retried, never
 *        acknowledged. a record the schema refused is a caller fault, so it is acknowledged and left
 *        out (`invariant.constraint-errors-never-redrive-sqs`)
 *
 * .note = retry is the default for every record this does not exclude, so a server fault met at
 *         validation needs no list of its own — it is simply never excluded
 * .note = deduped, since the source reads each id once
 */
export const getAllRecordIdsRetried = (input: {
  records: ReadonlyArray<{ id: string }>;
  successes: ReadonlyArray<{ id: string }>;
  idsRefused: ReadonlySet<string>;
}): string[] => {
  const idsSucceeded = new Set(input.successes.map((success) => success.id));
  const isRetried = (id: string): boolean =>
    !idsSucceeded.has(id) && !input.idsRefused.has(id);
  return [
    ...new Set(input.records.map((record) => record.id).filter(isRetried)),
  ];
};
