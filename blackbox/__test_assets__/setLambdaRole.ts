/**
 * .what = upsert the iam role a deployed test lambda assumes, and hand back the ref that
 *         a `DeclaredAwsLambda.role` field takes
 * .why = all four deployed suites declared the identical role — same path, same
 *        assume-role policy, same tags — and only the name and the description differ.
 *        that is rule.prefer.wet-over-dry's threshold, doubled
 *
 * ⚠️ .why it RETURNS the ref = each suite then wrote
 *         `RefByUnique.as<typeof DeclaredAwsIamRole>({ name: ROLE_NAME })` by hand, which
 *         repeats the name a second time in the same file. a name repeated is a name that
 *         can drift, and a lambda pointed at a role that was never upserted fails at
 *         deploy with an `AssumeRole` message that names the wrong cause. so the operation
 *         that KNOWS the name is the one that hands out the ref
 *
 * .note = `set` in the get/set/gen/del sense — `setIamRole({ upsert })` converges, so a
 *         re-run of a suite finds the extant role rather than a duplicate
 *         (rule.require.idempotent-procedures)
 */
import {
  DeclaredAwsIamRole,
  setIamRole,
  getDeclastructAwsProvider,
} from 'declastruct-aws';
import { RefByUnique } from 'domain-objects';
import { MalfunctionError } from 'helpful-errors';

export const setLambdaRole = async (
  input: {
    /** the iam role name, which is also its unique key */
    name: string;
    /** what a human who reads the aws console should learn about why it exists */
    description: string;
  },
  context: Awaited<ReturnType<typeof getDeclastructAwsProvider>>['context'],
): Promise<{ ref: RefByUnique<typeof DeclaredAwsIamRole> }> => {
  const role = DeclaredAwsIamRole.as({
    name: input.name,
    path: '/',
    description: input.description,
    policies: [
      {
        effect: 'Allow',
        principal: { service: 'lambda.amazonaws.com' },
        action: 'sts:AssumeRole',
      },
    ],
    tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
  });
  // ⚠️ .why the WRAP = the aws iam sdk rethrows a message that names the FAULT —
  //         `MalformedPolicyDocument`, `NoSuchEntity`, an `AccessDenied` — and not the
  //         SUBJECT this frame holds: which role name, which path, which suite asked. a
  //         maintainer who meets a red `deployed.*` suite then re-derives all three from the
  //         test, which is the identical cost `setLambdaLive`'s own wrap exists to close
  //         (rule.require.failloud)
  //
  // .the sweep = the stated cause is "a third-party error rethrown from a frame that HOLDS
  //              the subject its message omits". every such call in this directory, checked:
  //                setLambdaLive   -> setLambda                  ⛔ was bare; wrapped
  //                setLambdaRole   -> setIamRole                 ⛔ was bare; wrapped HERE
  //                setLambdaZip    -> esbuild.build              ✅ esbuild names entry + outfile
  //                setLambdaZip    -> mkdir / the write stream   ✅ a node fs error carries `path`
  //                getOneDeployContext -> getDeclastructAwsProvider
  //                                                              ⛔ was bare; wrapped
  //              ⇒ the family is five, and the three that were bare are now all wrapped
  //                (rule.require.sweep-the-defect-class)
  //
  // ⚠️ .the sweep's own correction = that last row read "✅ the guard above it IS the repair"
  //         for two rounds, and two reviewers converged to refute it. the guard answers whether
  //         a credential is PRESENT; it cannot answer whether the present one still WORKS, so
  //         an expired sso token sailed past it into a bare sdk error. ⇒ a sweep row that
  //         grades a site by ONE ARM of its cause reads as a checked site and is an unchecked
  //         one — the same shape as a sweep bounded to one axis
  //
  // ⚠️ .why the ELAPSED line below = this phase is the other term of a deploy hook's
  //         preflight budget (`LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS`, `setLambdaLive.ts`), and
  //         it is the term that VARIES most: a warm upsert finds the role, while a cold one
  //         creates it and waits on iam. so the budget is derived from a measurement, and a
  //         measurement nobody can re-take is an assertion
  //         (rule.require.measure-the-value-you-emit)
  const startedAt = Date.now();

  await MalfunctionError.wrap(() => setIamRole({ upsert: role }, context), {
    message: 'setLambdaRole: the iam role upsert did not converge',
    metadata: {
      role: input.name,
      path: role.path,
      description: input.description,
    },
  })();

  console.log(`⏱ ${input.name}: iam role upsert took ${Date.now() - startedAt}ms`);

  return {
    ref: RefByUnique.as<typeof DeclaredAwsIamRole>({ name: input.name }),
  };
};
