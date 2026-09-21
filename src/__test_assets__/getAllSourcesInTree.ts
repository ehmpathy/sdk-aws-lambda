import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * .what = lists every `.ts` source under a directory, recursively
 * .why = 🔴 a structural guard built on an IMPORT-GRAPH walk can only see what
 *        the graph reaches. a module that forks a boundary and is imported from
 *        OUTSIDE that graph is invisible to it — the guard reports green over a
 *        repo that holds the very fork it exists to bar.
 *
 *        ⇒ measured: `askLambdaEndpointAncient.ts` built a second `LambdaClient`
 *          for the whole life of this drive. `[case9] [t3]` walks from
 *          `runLambdaEndpoint.ts`, and that fixture is a SIBLING which no module
 *          in that graph imports — so it sat outside the guard, and eleven review
 *          rounds ran past it.
 *
 * .note = this is the PEER of `getAllReachableSources`, never its replacement.
 *   the two answer different questions and both are owed:
 *
 *   | walk | the question it answers |
 *   |---|---|
 *   | `getAllReachableSources` | does the SHIPPED path hold a fork? |
 *   | this one | does the REPO hold a fork, anywhere? |
 *
 *   ⇒ the graph walk is the sharper claim where it applies — a `jest` import in
 *     a `.test.ts` is fine and in the shipped graph is fatal, so that guard MUST
 *     stay graph-scoped. this walk is for the invariants that bind repo-wide.
 */
export const getAllSourcesInTree = (input: { from: string }): string[] =>
  readdirSync(input.from, { withFileTypes: true }).flatMap((entry) => {
    const at = join(input.from, entry.name);

    // recurse into a directory, minus the ones that hold no source of ours
    if (entry.isDirectory())
      return entry.name === 'node_modules' || entry.name.startsWith('.')
        ? []
        : getAllSourcesInTree({ from: at });

    // keep typescript sources, minus the declaration files a build emits
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')
      ? [at]
      : [];
  });
