/**
 * .what = a raw handler, wrapped by no `genLambdaEndpoint` family, that throws the value its event names
 * .why = the aws node runtime labels an escaped throw (`toRapidResponse`), and the local locus must
 *        label it the same. this one bundle runs at both loci, so a label that differs by locus
 *        is a defect of the sdk, never of two handler copies
 */
import { ConstraintError, MalfunctionError } from 'helpful-errors';

/**
 * .what = the throws whose label the runtime decides by a distinct branch of `toRapidResponse`
 * .why = each kind reaches a different arm: `.name` for an error, `typeof` for a bare value,
 *        `'handled'` where the runtime's own reads throw
 */
export type FaultKind =
  | 'constraint'
  | 'malfunction'
  | 'named'
  | 'string'
  | 'null'
  | 'namedFunction'
  | 'stackless';

/**
 * .what = builds the value a kind names
 * .why = one table, so the two loci throw the exact same value for each kind
 */
const asFault = (input: { kind: FaultKind }): unknown => {
  if (input.kind === 'constraint')
    return new ConstraintError('order id malformed');
  if (input.kind === 'malfunction')
    return new MalfunctionError('upstream down');
  if (input.kind === 'named')
    return Object.assign(new Error('quota spent'), { name: 'QuotaError' });
  if (input.kind === 'string') return 'quota spent';
  if (input.kind === 'null') return null;
  if (input.kind === 'namedFunction')
    return Object.assign(function quotaFault() {}, {
      message: 'quota spent',
      stack: 'quotaFault: quota spent\n    at handler',
    });

  // a stackless native error: the runtime's stack read throws, so its catch arm answers
  const stackless = new Error('quota spent');
  // biome-ignore lint/performance/noDelete: the absent stack is the subject of this kind
  delete (stackless as { stack?: string }).stack;
  return stackless;
};

/**
 * .what = throws the fault the event names, with no sdk family around it
 * .note = deployed as `faultLabelHandler.throwFault`; the local locus loads the same bundle
 */
export const throwFault = async (event: { kind: FaultKind }): Promise<never> => {
  throw asFault({ kind: event.kind });
};
