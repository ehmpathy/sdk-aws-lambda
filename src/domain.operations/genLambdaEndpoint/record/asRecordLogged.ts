import type { TranslateLog } from '../TranslateLog';

/**
 * .what = reads the one record back out of an event shape, when the shape still holds exactly one
 * .why = a redactor returns whatever it likes; only a `{ Records: [one] }` answer can be unwrapped
 */
const getOneRecordOfEvent = (input: { event: unknown }): unknown | null => {
  if (typeof input.event !== 'object' || input.event === null) return null;
  const records: unknown = Reflect.get(input.event, 'Records');
  if (!Array.isArray(records) || records.length !== 1) return null;
  return records[0];
};

/**
 * .what = the record a refusal line carries, after the author's log projection
 * .why = `logTranslate` is the one redaction hook an author declares, and a refusal line that
 *        carries the raw record is a second path to cloudwatch. so the record passes through the
 *        same projection the io logger applies, or a redacted field leaks on the first bad record
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .note = the projection meets `{ Records: [raw] }`, the event shape an author writes a redactor
 *         against, since `logTranslate.input` is called with the whole event everywhere else
 * .note = the answer is unwrapped back to the one record when the redactor kept the event shape,
 *         so the line reads the same with or without a projection; any other answer is logged as
 *         the redactor returned it, never second-guessed
 * .note = no projection declared → the raw record, untouched, so a replay reads it whole
 */
export const asRecordLogged = (input: {
  raw: unknown;
  logTranslate: TranslateLog | null;
}): unknown => {
  // no projection declared: the record as it arrived
  const translate = input.logTranslate?.input;
  if (!translate) return input.raw;

  // the record through the author's projection, in the event shape it was written against
  const projected = translate({ Records: [input.raw] });
  return getOneRecordOfEvent({ event: projected }) ?? projected;
};
