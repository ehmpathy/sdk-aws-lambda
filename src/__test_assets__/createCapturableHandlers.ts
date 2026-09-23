import { DomainEntity, DomainLiteral } from 'domain-objects';
import { z } from 'zod';

import { genLambdaEndpoint } from '../domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';

/**
 * .what = test domain-objects + genLambdaEndpoint handlers whose zod schemas
 *         reference `X.contract()`, so introspection stamps the
 *         `x-domain-object` pragma the codegen captures
 * .why = a self-contained fixture to exercise the codegen end-to-end via the
 *        in-process harness (no deploy) — an entity, a literal, a nested dobj,
 *        plus a schema-less dobj for the uc.9 uncapturable path
 */

// a literal dobj (no primary key) used nested inside Job
interface Address {
  city: string;
  postal: string;
}
class Address extends DomainLiteral<Address> implements Address {
  // a literal has no natural key — identity is all fields; only a schema is needed
  public static schema = z.object({ city: z.string(), postal: z.string() });
}

// an entity dobj (uuid primary key) that nests an Address
interface Job {
  uuid: string;
  title: string;
  address: Address;
}
class Job extends DomainEntity<Job> implements Job {
  public static primary = ['uuid'] as const;
  public static unique = ['title'] as const;
  public static alias = { singular: 'job', plural: 'jobs' };
  public static nested = { address: Address };
  public static schema = z.object({
    uuid: z.string(),
    title: z.string(),
    address: Address.contract(),
  });
}

/**
 * .what = handlers for a capturable service: two endpoints that surface Job
 * .why = getJob returns a single Job; getJobs returns many — the codegen must
 *        capture Job (+ nested Address) once, de-duped across both endpoints
 */
export const createCapturableHandlers = () => ({
  getJob: genLambdaEndpoint(
    {
      schema: {
        input: z.object({ uuid: z.string() }),
        output: z.object({ job: Job.contract() }),
      },
      // .note = `X.contract()` coerces, so its `TOutput` is a live instance — `invoke` owes a
      //         `new Job(...)` rather than a prop bag (the rule `refTrophyHandlers.ts` states)
      // .note = `address` stays a PLAIN object on purpose: `Job.nested` rebuilds it, so this
      //         one `new Job(...)` exercises the nested route too (uc.4)
      invoke: async () => ({
        job: new Job({
          uuid: 'job-1',
          title: 'a job',
          address: { city: 'austin', postal: '78704' },
        }),
      }),
    },
    { env: { access: 'prep' } },
  ),
  getJobs: genLambdaEndpoint(
    {
      schema: {
        input: z.object({ limit: z.number() }),
        output: z.object({ jobs: z.array(Job.contract()) }),
      },
      // .note = an EMPTY array carries no element, so there is no instance to construct here.
      //         the array's element contract is proven by `getJob` above, and this endpoint's
      //         own subject is that the codegen DE-DUPES `Job` across the two endpoints
      invoke: async () => ({ jobs: [] }),
    },
    { env: { access: 'prep' } },
  ),
});
