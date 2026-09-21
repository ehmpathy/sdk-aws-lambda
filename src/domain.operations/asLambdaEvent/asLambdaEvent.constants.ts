/**
 * 🔴 the aws region and account live at `domain.objects/AwsIdentitySynthetic`,
 *    and are NOT re-exported from here — a forwarder would be a second address
 *    for one value (`rule.forbid.barrel-exports`). import them directly.
 */

/**
 * .what = the instant every event factory stamps into its envelope
 * .why = a source envelope carries a timestamp, and a fixture must be
 *        deterministic — so the instant is frozen rather than read from a clock.
 *        `2025-09-08T00:00:00Z`.
 *
 * 🔴 **the UNIT is in the name because aws does not agree with itself.** sqs and
 *    api gateway stamp epoch MILLIS; kinesis stamps epoch SECONDS. the two
 *    literals differ by a factor of 1000, so side by side they read as a typo:
 *
 *      requestTimeEpoch: 1757289600000              ← api gateway, millis
 *      approximateArrivalTimestamp: 1757289600      ← kinesis, SECONDS
 *
 *    ⇒ the seconds value is DERIVED from the millis one rather than declared, so
 *      the two cannot drift and the relation is on the page
 *      (`rule.forbid.magic-values`).
 *
 * ⚠️ it is a placeholder, never a real instant. a test that asserts on it asserts
 *    on a fixture default — override `record` instead.
 *
 * 🔴 the ISO form is DERIVED for the same reason, and it is the representation a
 *    numeric-literal grep cannot reach — so it is the one most apt to keep a
 *    hand-written copy and drift a year, with no gate able to object (both
 *    strings are valid stamps of their own type).
 *
 * ⇒ all three flow from one literal. a factory that needs a fourth DERIVES it.
 */
export const AWS_EVENT_AT_EPOCH_MS = 1_757_289_600_000;
export const AWS_EVENT_AT_EPOCH_S = AWS_EVENT_AT_EPOCH_MS / 1000;
export const AWS_EVENT_AT_ISO = new Date(AWS_EVENT_AT_EPOCH_MS).toISOString();

/**
 * .what = casts an epoch into the CLF stamp api gateway sends as `requestTime`
 * .why = api gateway sends BOTH stamps on every request — `requestTimeEpoch` (a
 *        number) and `requestTime` (common log format, `08/Sep/2025:00:00:00 +0000`).
 *        a handler that reads the human one saw `undefined` in a test and a value
 *        in production, which is the wire-infidelity class this whole family exists
 *        to remove, reproduced on a peer field.
 *
 * .how = derived from the ONE literal above. a hand-written CLF string that
 *   drifted from the epoch would name two instants in one envelope, and no gate
 *   could catch it — both are valid stamps of their own kind.
 *
 * .note = the offset is `+0000` unconditionally, because aws stamps utc and the
 *   epoch above is utc. a local-time derivation would drift by the builder's
 *   timezone and make the fixture non-deterministic across machines.
 */
const asClfStamp = (epochMs: number): string => {
  const at = new Date(epochMs);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    pad(at.getUTCDate()),
    '/',
    months[at.getUTCMonth()],
    '/',
    at.getUTCFullYear(),
    ':',
    pad(at.getUTCHours()),
    ':',
    pad(at.getUTCMinutes()),
    ':',
    pad(at.getUTCSeconds()),
    ' +0000',
  ].join('');
};

export const AWS_EVENT_AT_CLF = asClfStamp(AWS_EVENT_AT_EPOCH_MS);
