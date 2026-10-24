import { isSqsSuccessRef } from './isSqsSuccessRef';

/**
 * .what = the entries of a perBatch answer that carry no string `id`, each with its position
 * .why = sqs can delete only by id, so an entry without one is no success at all. the position
 *        lets the refusal name exactly which entries the handler got wrong
 */
export const getAllSqsSuccessRefsMalformed = (input: {
  successes: ReadonlyArray<unknown>;
}): { index: number; got: string }[] =>
  input.successes
    .map((success, index) => ({ index, success }))
    .filter(({ success }) => !isSqsSuccessRef(success))
    .map(({ index, success }) => ({
      index,
      got: success === null ? 'null' : typeof success,
    }));
