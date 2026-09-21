import { randomUUID } from 'node:crypto';

/**
 * .what = mints the synthetic per-record uuid the sqs/sns fixtures stamp
 * .why = `beefbeef` marks it synthetic; the rest is real v4 entropy, so two
 *   fixtures in one store cannot collide. valid v4 shape, so a uuid regex passes.
 * .note = NOT deterministic. to assert on an id, override `record`.
 */
export const asExampleUuid = (): string => `beefbeef${randomUUID().slice(8)}`;
