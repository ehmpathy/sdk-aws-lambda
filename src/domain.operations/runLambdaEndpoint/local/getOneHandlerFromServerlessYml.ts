import { ConstraintError, MalfunctionError } from 'helpful-errors';

import { existsSync, readFileSync } from 'node:fs';
import { resolve as asAbsolutePath, dirname, join } from 'node:path';
import { isErrorLike } from '../error/isErrorLike';

/**
 * .what = finds the project root — the nearest ancestor with a package.json
 * .why = serverless.yml sits beside package.json, and a test runs from an
 *        arbitrary cwd
 *
 * .note = DELIBERATE MUTATION ZONE (rule.require.immutable-vars, scoped
 *   exception). `at` is a cursor per hop up the ancestor chain — an ascent has no
 *   map/reduce form, and the pure alternative costs a frame per directory. the
 *   cursor is local; only a string escapes.
 */
const getOneProjectRoot = (input: { from: string }): string => {
  let at = asAbsolutePath(input.from);
  for (;;) {
    if (existsSync(join(at, 'package.json'))) return at;
    const up = dirname(at);
    if (up === at)
      return ConstraintError.throw(
        'could not find a project root — no package.json in any ancestor',
        {
          from: input.from,

          // 🔴 the FIRST throw an `at: 'local'` caller is likely to meet, so it
          //    owes a next step (`rule.require.errors-name-the-fix`).
          hint: "run from inside the project, or pass `from:` pointing at the directory that holds your package.json — e.g. `{ at: 'local', from: process.cwd() }`",
        },
      );
    at = up;
  }
};

/**
 * .what = casts a serverless.yml `handler:` string into its two parts
 * .why = the value reads `path/to/file.exportName`, and the split is a regex with
 *   two positional groups — inline, that is decode-friction.
 *
 * .note = answers `null` rather than throws, because the caller's throw carries
 *   `pathOfConfig` and the yml key to edit, and none of that is knowable here.
 */
const asHandlerPathAndExport = (input: {
  handler: string | undefined;
}): { pathOfFile: string; nameOfExport: string } | null => {
  const matched = input.handler?.match(/^([\w\-./]+)\.(\w+)$/);
  if (!matched) return null;
  return { pathOfFile: matched[1]!, nameOfExport: matched[2]! };
};

/**
 * .what = the shape this file reads off a serverless.yml
 * .why = named once, because the memo below and its reader must agree on it
 */
interface ServerlessConfig {
  service?: string;
  functions?: Record<string, { handler?: string }>;
}

/**
 * .what = the parsed serverless.yml, memoized against the FILE'S OWN CONTENT
 * .why = `yaml.parse` is ~78% of this operation's cost. measured on a 6.5 KB yml
 *   (40 functions), 1000 runs: parse 8.778 ms/call · root ascent 0.019 · a
 *   `readFileSync`, which is what a hit costs instead, 0.010.
 *
 * 🔴 the key is the file's CONTENT, never `(service, function, from)` — that key
 *    caches a PATH's content under a LOOKUP's identity, so a consumer who rewrites
 *    its serverless.yml mid-process is served a stale parse and goes green on a
 *    file that no longer exists (rule.forbid.failhide).
 *
 *    an mtime+size key narrows that race and leaves one: a rewrite inside one tick
 *    that keeps an identical byte length — a rename to another name of the same
 *    length. content removes the class, and costs 0.006 ms over a stat to do it.
 *
 * ✅ only the PARSE is cached. the four throws below re-run every call, because a
 *    result-level memo would keep the old error after a repaired serverless.yml.
 *
 * .note = DELIBERATE MUTATION ZONE (rule.require.immutable-vars, scoped
 *   exception). module-private, never read by a caller, and it changes only how
 *   long the operation takes.
 */
const parsedConfigByPath = new Map<
  string,
  { raw: string; config: ServerlessConfig }
>();

/**
 * .what = looks up the handler function a serverless.yml declares for an endpoint
 * .why = `at: 'local'` addresses the endpoint by SLUG, so the util must find the
 *   function the slug names. same mechanism the incumbent uses.
 *
 * 🔴 every failure names the fix — case=10's whole subject. when the lookup fails
 *    the incumbent's error blames the HANDLER and the author debugs the wrong
 *    file, so each throw below states what was sought, where it looked, and what
 *    to do (rule.require.errors-name-the-fix).
 */
export const getOneHandlerFromServerlessYml = async (input: {
  service: string;
  function: string;
  /**
   * where to start the search for the project root. cwd by default.
   */
  from?: string;
}): Promise<(event: unknown, context: unknown) => Promise<unknown>> => {
  const root = getOneProjectRoot({ from: input.from ?? process.cwd() });
  const pathOfConfig = join(root, 'serverless.yml');

  if (!existsSync(pathOfConfig))
    return ConstraintError.throw(
      'no serverless.yml found, so a local endpoint cannot be looked up',
      {
        sought: pathOfConfig,
        projectRoot: root,
        hint: "add a serverless.yml, or run with at: 'cloud' to invoke the deployed function",
      },
    );

  // the file's own content, which is what the memo above keys on
  const raw = readFileSync(pathOfConfig, 'utf8');
  const memoed = parsedConfigByPath.get(pathOfConfig);

  const config: ServerlessConfig =
    memoed && memoed.raw === raw
      ? memoed.config
      : await (async () => {
          /**
           * .what = `yaml` is reached LAZILY, never at module load
           * .why = this file is its only reader and runs on one path
           *   (`at: 'local'`, a test-time locus). a static import would put a
           *   670 KB parser in the module graph of every consumer that merely
           *   imports the root barrel.
           *
           * 🟡 LOAD time only. `yaml` stays in `dependencies`, so install size is
           *    unchanged and a consumer who BUNDLES still gets it. the install
           *    half wants an `exports`-map subpath split (F4).
           */
          const { parse: parseYaml } = await import('yaml');

          /**
           * .as = `parseYaml` answers `any`; a yml file has no compile-time shape.
           *   every field is declared OPTIONAL, so the cast asserts no key a real
           *   file might lack — each is re-checked at runtime.
           * .removal = never. 🟡 a zod parse WOULD remove it, and would collapse
           *   the four throws below into one schema error that names none of their
           *   fixes — which is case=10's whole subject.
           */
          const fresh = parseYaml(raw) as ServerlessConfig;

          parsedConfigByPath.set(pathOfConfig, { raw, config: fresh });
          return fresh;
        })();

  // the slug names a service; a mismatch means the test addresses another repo
  if (config.service !== input.service)
    return ConstraintError.throw(
      'the serverless.yml declares a different service than the endpoint names',
      {
        declared: config.service,
        addressed: input.service,
        pathOfConfig,
        hint: 'check input.which.service — a local run can only reach endpoints of THIS repo',
      },
    );

  const definition = config.functions?.[input.function];
  if (!definition)
    return ConstraintError.throw(
      'the serverless.yml declares no such function',
      {
        addressed: input.function,
        declared: Object.keys(config.functions ?? {}),
        pathOfConfig,
        hint: `add serverless.yml#functions.${input.function}, or check it against the declared list`,
      },
    );

  const parts = asHandlerPathAndExport({ handler: definition.handler });
  if (!parts)
    return ConstraintError.throw(
      'the serverless.yml handler is malformed — it must read `path/to/file.exportName`',
      {
        found: definition.handler,
        addressed: input.function,
        pathOfConfig,
      },
    );

  const pathOfHandler = join(root, parts.pathOfFile);
  const nameOfExport = parts.nameOfExport;

  const module = await (async () => {
    try {
      /**
       * .as = a dynamic import of a runtime path has no compile-time shape. the
       *   value is re-narrowed below by `typeof handler !== 'function'`.
       * .removal = never
       */
      return (await import(pathOfHandler)) as Record<string, unknown>;
    } catch (error) {
      /**
       * .what = reads the message by duck-type, never by `instanceof Error`
       * .why = 🔴 `instanceof` fails CROSS-REALM, and a test util runs in exactly
       *   the place with two realms — jest executes each module in its own vm
       *   context, so an `Error` its resolver constructs is not the test realm's.
       *   an `instanceof` guard here rethrows the raw module error before the
       *   message check can run. caught by case=10 `[t0]`.
       */
      const message = isErrorLike(error) ? error.message : '';

      // 🔴 case=10: the incumbent lets this surface as a bare module error, and
      //    the author debugs the handler that never loaded. name the real fault.
      if (message.includes('Cannot find module'))
        return ConstraintError.throw(
          'the serverless.yml points at a handler file that does not exist',
          {
            declared: definition.handler,
            sought: pathOfHandler,
            addressed: input.function,
            pathOfConfig,
            hint: `the handler MOVED or the path is stale — update serverless.yml#functions.${input.function}.handler`,
          },
        );

      // 🔴 any other import failure is the HANDLER'S OWN — a syntax error, a throw
      //    at module scope, a bad transitive import — so the original must survive:
      //    its message and stack carry the file and line, which IS the fix.
      //
      //    ⚠️ a bare rethrow is not good enough either: it answers `SyntaxError:
      //       Unexpected token` with no word about WHICH file this util tried to
      //       load. `cause` carries both (rule.prefer.helpful-error-wrap).
      //
      //    ✅ bite-probed: restore the bare `throw error` and `[case6]` goes red on
      //       both halves.
      throw new MalfunctionError(
        'the handler file was found but could not be imported',
        {
          pathOfHandler,
          declared: definition.handler,
          addressed: input.function,
          pathOfConfig,
          hint: 'the fault is inside the handler module itself — read `cause` below for its own error, which names the file and line. this util found the file exactly where serverless.yml said it would be.',

          // 🔴 `isErrorLike`, never `instanceof Error` — the same cross-realm
          //    reason as above. a non-Error throw keeps its context in `thrown`,
          //    so nothing is lost whatever the module threw.
          ...(isErrorLike(error) ? { cause: error } : { thrown: error }),
        },
      );
    }
  })();

  const handler = module[nameOfExport];
  if (typeof handler !== 'function')
    return ConstraintError.throw('the handler file exports no such function', {
      sought: nameOfExport,
      found: Object.keys(module),
      pathOfHandler,
      addressed: input.function,
      hint: `export \`${nameOfExport}\` from that file, or update serverless.yml#functions.${input.function}.handler`,
    });

  /**
   * .as = the `typeof` guard narrows to `Function`, which carries no parameter or
   *   return type. no runtime check can supply a signature.
   * .why-not-assure = `.assure` throws a generic rejection error; this throw
   *   carries `sought`, `found`, `pathOfHandler`, and the exact yml key to edit.
   * .removal = never
   */
  return handler as (event: unknown, context: unknown) => Promise<unknown>;
};
