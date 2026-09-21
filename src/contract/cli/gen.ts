#!/usr/bin/env node

import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { type ContextLogTrail, genContextLogTrail } from 'sdk-logs';

import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import { genServiceSdk } from '../../domain.operations/genServiceSdk/genServiceSdk';
import { asGenArgs } from './asGenArgs';

/**
 * .what = the `sdk-aws-lambda gen` cli entrypoint
 * .why = generates a per-service sdk into a target dir from live introspection;
 *        validates args, routes --env into ambient context, and maps errors to
 *        semantic exit codes (0 ok / 1 malfunction / 2 constraint)
 *
 * .context = the caller may inject `log` (observability) + `aws` (sdk seam for
 *            tests); both default when absent so the bin can call `gen({ argv })`.
 *            `env.access` is NOT injected here — it is parsed from `--env` (the cli
 *            is the composition root that maps the flag into ambient access).
 */
export const gen = async (
  input: {
    argv: string[];
  },
  context?: {
    log?: ContextLogTrail['log'];
    aws?: ContextAwsLambdaCaller['aws'];
  },
): Promise<{ exit: number; message: string | null }> => {
  const log =
    context?.log ?? genContextLogTrail({ trail: null, env: null }).log;

  try {
    // validate args at the boundary (throws ConstraintError → exit 2)
    const args = asGenArgs({ argv: input.argv });

    // route the --env flag into ambient context.env.access, then generate
    await genServiceSdk(
      { which: { service: args.service }, into: args.into },
      { log, env: { access: args.access }, aws: context?.aws },
    );

    return { exit: 0, message: null };
  } catch (error) {
    // caller-must-fix errors → exit 2; server/unexpected → exit 1. surface the
    // message on the result (not only via log) so callers + tests can assert +
    // snapshot exactly what the user sees
    const exit = getExitForError({ error });
    const message = error instanceof Error ? error.message : String(error);
    log.error('gen failed', { exit, error: message });
    return { exit, message };
  }
};

/**
 * .what = decide whether a thrown error is a caller-must-fix constraint
 * .why = every codegen error class (LambdaCredentialsAbsentError,
 *        LambdaIntrospectionBlockedError, LambdaServiceNotFoundError,
 *        LambdaFunctionNotFoundError, LambdaIntrospectionNotSupportedError,
 *        LambdaDomainObjectNotCapturableError) extends ConstraintError, so a single
 *        `instanceof ConstraintError` covers them all — no per-class chain to keep in
 *        sync (a new Lambda*Error extends ConstraintError is caught automatically)
 */
const isConstraintError = (error: unknown): boolean =>
  error instanceof ConstraintError;

/**
 * .what = map a thrown error to its semantic exit code
 * .why = constraint errors (caller must fix) exit 2; malfunctions exit 1
 *
 * ## 🔴 why an UNCLASSIFIED error exits 1, and must never exit 2
 *
 * exit 2 is a claim about WHOSE fault it is — `rule.require.exit-code-semantics`
 * fixes it as *the caller must repair their own input*. so a default of 2 would
 * send a developer to hunt through their own arguments for a fault this cli
 * could not classify at all.
 *
 * ⇒ when the blame is unproven, 1 is the honest answer: it reports a
 *   server-side malfunction, which is what an unrecognized throw IS from this
 *   cli's vantage. the asymmetry is the point — a malfunction mislabelled a
 *   constraint sends the caller on that hunt AND suppresses the retry a
 *   transient fault deserves, where the reverse merely over-reports.
 *
 * .note = the two `1` arms are deliberately NOT collapsed. the
 *   `MalfunctionError` arm states an intent (this IS a malfunction); the final
 *   arm states a default (the class was unrecognized). to merge them would
 *   erase which of the two a given exit came from.
 */
const getExitForError = (input: { error: unknown }): number => {
  if (isConstraintError(input.error)) return 2;
  if (input.error instanceof MalfunctionError) return 1;
  return 1;
};

// when invoked as a bin, run + set the process exit code
/* istanbul ignore next */
if (require.main === module) {
  gen({ argv: process.argv.slice(2) })
    .then(({ exit }) => {
      process.exitCode = exit;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}
