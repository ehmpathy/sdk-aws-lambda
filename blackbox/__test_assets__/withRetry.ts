/**
 * .what = retry with linear backoff, until an attempt succeeds, the predicate refuses, or the
 *         attempts run out
 * .why = it holds no subject at all — no lambda, no iam, no aws. it takes an operation, a
 *        predicate, and a budget, and it would read the same in a repo that had never heard
 *        of a lambda
 *
 * ⚠️ .why it is its OWN file = it lived inside `setLambdaLive.ts`, beside that file's deploy
 *    budget, its iam-propagation predicate, and its orchestrator. two reviewers named the
 *    mix: a generic retry primitive has zero conceptual tie to a lambda-deploy budget, so
 *    the file carried four grains and the reader had to sort them
 *    (rule.require.single-responsibility)
 *
 * ⇒ and the payoff is concrete rather than aesthetic: this function has real branches — a
 *   refusal, an exhaustion, a backoff that grows — and INSIDE that file they were reachable
 *   only through a live aws deploy. on its own they are a unit test, which is what
 *   `withRetry.test.ts` beside it now is
 *
 * .note = the `with*` prefix is the sanctioned one for a higher-order wrapper
 *         (rule.require.get-set-gen-verbs)
 *
 * 🟡 .why the signature is POSITIONAL, against the repo's named-input default = a `with*`
 *         wrapper is the one shape the input-object convention exempts, and `withRetry` is
 *         named in that exemption by name. `rule.require.hook-wrapper-pattern` prints this
 *         exact call verbatim as its own canonical form:
 *
 *           export const processPayment = withLogTrail(withRetry(_processPayment, { maxAttempts: 3 }));
 *
 *         the subject of a decorator is the function it wraps, so it takes the first slot and
 *         the composition reads outward-in. fold it into one object and
 *         `withLogTrail(withRetry({ operation: f, options: o }))` no longer reads as a
 *         pipeline — which is the whole payoff of the `with*` family
 *         (raised as a nitpick at i018; argued rather than taken, with this citation)
 *
 * .note = still PRIVATE to `blackbox/__test_assets__` — this is a move between files rather
 *         than a lift toward `src`. one caller, one home, and no speculative export
 *         (rule.prefer.most-common-denominator)
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoffMs: number;
    shouldRetry: (error: Error) => boolean;
    /**
     * .what = called once per backoff, before the sleep
     * .why = a caller's retry phase can block for tens of seconds, and a blocked phase with
     *        no output reads as a HUNG suite rather than as latency
     *        (rule.require.status-feedback)
     * .why a CALLBACK rather than a `console.log` in here = this function is generic and
     *      holds no subject; the caller holds the name of whatever it drives
     *
     * .why OPTIONAL = it is purely observational and changes no behavior, so a caller that
     *      wants no progress output must not be made to invent a `() => undefined`. absence
     *      denotes "emit no progress", which is a real state rather than a hole
     *      (rule.prefer.defaults-match-common-case; `options` is exempt from
     *      rule.forbid.undefined-inputs, which binds the `input` argument alone)
     */
    onRetry?: (input: { attempt: number; waitMs: number; error: Error }) => void;
  },
): Promise<T> => {
  const attempt = async (n: number): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (!options.shouldRetry(error)) throw error;
      if (n >= options.maxAttempts) throw error;
      const waitMs = options.backoffMs * n;
      options.onRetry?.({ attempt: n, waitMs, error });
      await new Promise((r) => setTimeout(r, waitMs));
      return attempt(n + 1);
    }
  };
  return attempt(1);
};
