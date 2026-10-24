/**
 * .what = the ids a perBatch answer claims that the handler was never handed
 * .why = a claim on a record outside the validated set — a forged id, or one drawn from
 *        `event.records` — would delete a message no handler served, so each must be refused
 */
export const getAllSqsIdsUnclaimable = (input: {
  successes: ReadonlyArray<{ id: string }>;
  idsClaimable: ReadonlySet<string>;
}): string[] =>
  input.successes
    .map((success) => success.id)
    .filter((id) => !input.idsClaimable.has(id));
