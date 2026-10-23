/**
 * .what = the cloud runtime's own label for an escaped throw, read off the real wire, beside the
 *         label the local locus writes for the same bundle
 * .why = 🔴 the local locus mirrors `toRapidResponse` from its source (sdk-aws-lambda#73). a mirror
 *        read from source is a claim; this suite is the measurement. it deploys one raw handler,
 *        throws each value whose label a distinct runtime branch decides, and asserts the two loci
 *        agree. a label rule change upstream turns this red, where a unit row would stay green
 *
 * this test:
 * 1. bundles `faultLabelHandler.ts` once, so both loci run the same bytes
 * 2. deploys it to aws via declastruct-aws imperative operations
 * 3. runs each fault kind at the cloud locus and at the local locus
 * 4. asserts the wire label and the message each caller reads are the same on both
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { DeclaredAwsLambda, genDeclaredAwsLambdaCode } from 'declastruct-aws';
import { ConstraintError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { genTempDir, getError, given, then, useBeforeAll, useThen, when } from 'test-fns';

import { runLambdaEndpoint } from '../src/index';
import type { FaultKind } from './__test_assets__/faultLabelHandler';
import { getOneDeployContext } from './__test_assets__/getOneDeployContext';
import {
  LAMBDA_DEPLOY_HOOK_BUDGET_MS,
  setLambdaLive,
} from './__test_assets__/setLambdaLive';
import { setLambdaRole } from './__test_assets__/setLambdaRole';
import { setLambdaZip } from './__test_assets__/setLambdaZip';

const HANDLER_SOURCE = path.join(
  __dirname,
  '__test_assets__',
  'faultLabelHandler.ts',
);
const BUILD_DIR = path.join(__dirname, '..', '.build');
const BUNDLE_NAME = 'faultLabelHandler';

const ROLE_NAME = 'sdk-aws-lambda-e2e-faultlabel-role';
const SERVICE = 'svc-faultlabel';
const FUNCTION = 'throwFault';
const LAMBDA_NAME = `${SERVICE}-prod-${FUNCTION}`;
const REGION = 'us-east-1';

// one deploy budget plus headroom, and seven invokes per locus after it
jest.setTimeout(LAMBDA_DEPLOY_HOOK_BUDGET_MS);

/**
 * .what = each fault kind and the label the aws node runtime writes for it
 * .why = the expected labels are the branches of `toRapidResponse`; the suite asserts the cloud
 *        writes them, then that the local locus writes the same
 */
const KINDS: { kind: FaultKind; label: string }[] = [
  { kind: 'constraint', label: 'Error' }, // helpful-errors 1.7.3 leaves `.name` at 'Error'
  { kind: 'malfunction', label: 'Error' },
  { kind: 'named', label: 'QuotaError' },
  { kind: 'string', label: 'string' },
  { kind: 'null', label: 'string' }, // `CallbackContext.fail` swaps a null rejection for the string 'handled'
  { kind: 'namedFunction', label: 'quotaFault' },
  { kind: 'stackless', label: 'handled' },
];

/**
 * .what = a temp repo whose serverless.yml points the local locus at the deployed bundle
 * .why = the local locus reads a serverless.yml off disk; a handler that re-exports the bundle
 *        makes the local run execute the exact bytes the lambda runs
 */
const genLocalRepo = (input: { bundlePath: string }): string => {
  const dir = genTempDir({ slug: 'deployed-fault-label-local' });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'temp' }));
  writeFileSync(
    path.join(dir, 'serverless.yml'),
    [
      `service: ${SERVICE}`,
      'functions:',
      `  ${FUNCTION}:`,
      `    handler: handler.${FUNCTION}`,
    ].join('\n'),
  );
  writeFileSync(
    path.join(dir, 'handler.js'),
    `module.exports = require(${JSON.stringify(input.bundlePath)});`,
  );
  return dir;
};

/**
 * .what = the facts a caller acts on, for one hydrated fault
 * .why = the class says which fault side a caller reads, the wire label is the runtime's own
 *        verdict, and the headline is the first line of the message, before any stack frame
 */
const asCallerView = (input: { error: Error }) => ({
  class: input.error.constructor.name,
  isCallerFault: input.error instanceof ConstraintError,
  wireLabel:
    (input.error as unknown as { metadata?: { errorType?: unknown } })
      .metadata?.errorType ?? null,
  messageHeadline: input.error.message.split('\n')[0] ?? '',
});

/**
 * .what = the hydrated error, whole, with its volatile fields masked
 * .why = a deny-list keeps every field the caller receives, so a field this suite never named
 *        still shows as a diff (`rule.require.snapshots-deny-volatile-not-allow-expected`). the
 *        generated exid and the stack frames move per run and per locus
 * .note = the bundle's class-name suffix is masked too. the sdk's tree holds two helpful-errors
 *         copies (`with-simple-cache` pins 1.5.3 beside 1.7.3), so esbuild renames one
 *         `ConstraintError` to `ConstraintError2` by module order. the suffix names no class a
 *         caller can find, and the runtime label this suite measures never reads it. the dedupe
 *         is caught as `.dream/2026_10_22.dedupe-helpful-errors-copies-in-sdk-bundle.dream.md`
 */
const asHeadlineUnsuffixed = (input: { headline: string }): string =>
  input.headline.replace(/\b(\w+Error)\d+:/g, '$1:');

const asErrorMasked = (input: { error: Error }): Record<string, unknown> => {
  const metadata =
    (input.error as unknown as { metadata?: Record<string, unknown> })
      .metadata ?? {};
  return {
    class: input.error.constructor.name,
    messageHeadline: asHeadlineUnsuffixed({
      headline: input.error.message.split('\n')[0] ?? '',
    }),
    metadata: {
      ...metadata,
      ...('exid' in metadata ? { exid: '<exid>' } : {}),
      ...('stackTrace' in metadata ? { stackTrace: '<stackTrace>' } : {}),
    },
  };
};

describe('e2e: deployed raw handler, its escaped throw labelled on both loci', () => {
  const deployed = useBeforeAll(async () => {
    // bundle once; both loci run this file
    const { zipPath } = await setLambdaZip({
      handlerSource: HANDLER_SOURCE,
      buildDir: BUILD_DIR,
      bundleName: BUNDLE_NAME,
    });
    const bundlePath = path.join(BUILD_DIR, `${BUNDLE_NAME}.js`);

    // credentials, then the role the lambda assumes
    const { context } = await getOneDeployContext();
    const { ref: roleRef } = await setLambdaRole(
      {
        name: ROLE_NAME,
        description: 'role for the sdk-aws-lambda fault label acceptance test',
      },
      context,
    );

    // upsert the lambda and block until the next invoke reads this code
    const lambda = DeclaredAwsLambda.as({
      name: LAMBDA_NAME,
      runtime: 'nodejs20.x',
      handler: `${BUNDLE_NAME}.${FUNCTION}`,
      timeout: 30,
      memory: 128,
      role: roleRef,
      envars: { NODE_ENV: 'test' },
      code: genDeclaredAwsLambdaCode({ zipUri: zipPath }),
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });
    await setLambdaLive({ lambda, region: REGION }, context);

    return { localRepo: genLocalRepo({ bundlePath }) };
  });

  given('[case1] a raw handler that throws, once per runtime label branch', () => {
    when('[t0] each fault is met at the cloud locus and at the local locus', () => {
      // one invoke per kind per locus; every then below reads these rows
      const rows = useThen('every invoke fails', async () => {
        const context = {
          ...genContextLogTrail({ trail: null, env: null }),
          env: { access: 'prod' as const, region: REGION },
        };
        const views = [];
        for (const { kind, label } of KINDS) {
          const cloud = await getError(
            runLambdaEndpoint.onSerialized(
              {
                which: { service: SERVICE, function: FUNCTION },
                event: { kind },
                at: 'cloud',
                struct: { payload: 'ancient' },
              },
              context,
            ),
          );
          const local = await getError(
            runLambdaEndpoint.onSerialized(
              {
                which: { service: SERVICE, function: FUNCTION },
                event: { kind },
                at: 'local',
                from: deployed.localRepo,
                struct: { payload: 'ancient' },
              },
              context,
            ),
          );
          views.push({
            kind,
            label,
            cloud: asCallerView({ error: cloud }),
            local: asCallerView({ error: local }),
            cloudMasked: asErrorMasked({ error: cloud }),
          });
        }
        return { views };
      });

      then('the cloud writes the label the runtime source names', () => {
        expect(
          rows.views.map((row) => ({ kind: row.kind, label: row.cloud.wireLabel })),
        ).toEqual(KINDS.map(({ kind, label }) => ({ kind, label })));
      });

      then('the local locus writes the same label as the cloud', () => {
        for (const row of rows.views)
          expect({ kind: row.kind, label: row.local.wireLabel }).toEqual({
            kind: row.kind,
            label: row.cloud.wireLabel,
          });
      });

      then('a caller reads the same fault on both loci', () => {
        // the class and the headline are what a caller acts on; both must not move by locus
        for (const row of rows.views) expect(row.local).toEqual(row.cloud);
      });

      then('a raw ConstraintError reads as a server fault, as the cloud answers it', () => {
        const constraint = rows.views.find((row) => row.kind === 'constraint');
        expect(constraint?.cloud.isCallerFault).toEqual(false);
        expect(constraint?.cloud.messageHeadline).toContain('order id malformed');
      });

      /**
       * .what = the error each cloud caller receives, one row per kind, the shared endpoint once
       * .why = every row names the same endpoint, so it is hoisted rather than masked: it still
       *        shows, once, and the then asserts each row carries it. each row also states the
       *        label it expects and the fault side a caller reads, so the snapshot reads alone
       */
      then('each escaped throw reaches the cloud caller labelled by the runtime rule, one row per branch', () => {
        const asMetadata = (masked: Record<string, unknown>) =>
          (masked.metadata ?? {}) as Record<string, unknown>;

        // the endpoint is the one field no throw can change, so it alone is hoisted; the class and
        // the fault side stay per row, since the `constraint` row flips both on the helpful-errors bump
        const endpoint = asMetadata(rows.views[0]?.cloudMasked ?? {}).endpoint;
        for (const row of rows.views)
          expect(asMetadata(row.cloudMasked).endpoint).toEqual(endpoint);
        expect({
          endpoint,
          rows: rows.views.map((row) => {
            const { endpoint: _hoisted, ...metadataRest } = asMetadata(
              row.cloudMasked,
            );
            return {
              kind: row.kind,
              labelExpected: row.label,
              isCallerFault: row.cloud.isCallerFault,
              ...(row.kind === 'constraint'
                ? {
                    note: "helpful-errors 1.7.3 leaves .name at 'Error', so a raw ConstraintError is a server fault here; it flips to a caller fault once helpful-errors#47 ships",
                  }
                : {}),
              error: { ...row.cloudMasked, metadata: metadataRest },
            };
          }),
        }).toMatchSnapshot();
      });
    });
  });
});
