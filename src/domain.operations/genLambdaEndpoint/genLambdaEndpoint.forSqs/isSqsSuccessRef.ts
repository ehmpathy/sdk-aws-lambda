/**
 * .what = whether a value is one sqs can delete by: an object with a string `id`
 * .why = a perBatch answer is read at runtime, so a js caller or an `any` site can hand over a
 *        bare id string, a `null`, or an object with no `id` — none of which names a message
 */
export const isSqsSuccessRef = (value: unknown): value is { id: string } =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string';
