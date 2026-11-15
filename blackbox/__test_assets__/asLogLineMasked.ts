/**
 * .what = one sdk log line, with each field that moves per run or per machine masked, and every
 *         other field kept whole
 * .why = the local log outlet hands the console `{ level, timestamp, message, metadata, trail }`,
 *        where `metadata` is a json string. a snapshot of the whole line catches the field no one
 *        predicted (`rule.require.snapshots-deny-volatile-not-allow-expected`), so the line is kept
 *        whole and only these are masked:
 *        - `timestamp`, set at write time
 *        - a generated uuid (a trail exid, an exid in a message)
 *        - a harness port, and a `date` response header, raw or json-escaped
 *        - the frames of a `stackTrace`: absolute paths and line numbers, which differ per machine
 *          and per edit. its first line (class and the message's first line) is kept, so the
 *          stack still names the error it belongs to; the full message rides `errorMessage`
 */
export const asLogLineMasked = (input: {
  line: Record<string, unknown>;
}): Record<string, unknown> => {
  // read the metadata as data, so its keys sort and diff like the rest of the line
  const metadata =
    typeof input.line.metadata === 'string'
      ? (JSON.parse(input.line.metadata) as unknown)
      : input.line.metadata;

  // keep the stack header, mask its frames
  const metadataMasked =
    typeof metadata === 'object' &&
    metadata !== null &&
    typeof (metadata as { stackTrace?: unknown }).stackTrace === 'string'
      ? {
          ...metadata,
          stackTrace: asStackFramesMasked({
            stack: (metadata as { stackTrace: string }).stackTrace,
          }),
        }
      : metadata;

  // mask the volatile text in every string the line holds
  const lineMasked = {
    ...input.line,
    timestamp: '<timestamp>',
    metadata: metadataMasked,
  };
  return JSON.parse(
    asVolatileTextMasked({ text: JSON.stringify(lineMasked) }),
  ) as Record<string, unknown>;
};

/**
 * .what = a stack trace cut to its first line, with its frames replaced by one marker
 * .why = the first line names the error class; the rest of the header repeats the message that
 *        `errorMessage` already holds, and the frames name paths on this machine
 */
const asStackFramesMasked = (input: { stack: string }): string => {
  const headerFirstLine = input.stack.split('\n')[0] ?? '';
  return `${headerFirstLine}\n    at [frames]`;
};

/**
 * .what = serialized text with each run-volatile value masked
 * .why = the port, the date header, and a generated uuid move each run. a generated trail exid
 *        reads `exid:[masked]`, the one form every suite of this repo writes for it
 */
const asVolatileTextMasked = (input: { text: string }): string =>
  input.text
    .replace(/127\.0\.0\.1:\d+/g, '127.0.0.1:[port]')
    .replace(/(\\*"date\\*":\s*\\*")[^"\\]*/g, '$1[date]')
    .replace(
      /exid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      'exid:[masked]',
    )
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '[uuid]',
    );
