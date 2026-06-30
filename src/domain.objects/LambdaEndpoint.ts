import { DomainEntity } from 'domain-objects';

/**
 * .what = the domain entity for a callable lambda endpoint
 * .why = a single ubiquitous concept to address a lambda, instead of a flat
 *        functionName string + loose service/function fields
 *
 * .keys
 *   - primary = ['slug'] — serialized natural key; also the aws function name
 *   - unique  = ['service', 'access', 'function'] — the natural key
 *
 * .slug = '{service}-{access}-{function}'  e.g. 'svc-invoice-prep-getInvoice'
 */
export interface LambdaEndpoint {
  /**
   * .what = the owner service, in svc-$noun form
   */
  service: string;

  /**
   * .what = the env access level (test | prep | prod)
   */
  access: string;

  /**
   * .what = the function (the "bare" name, no service/access prefix)
   */
  function: string;

  /**
   * .what = the serialized key '{service}-{access}-{function}'
   * .why = the aws lambda function name; doubles as the wire identifier
   */
  slug: string;
}

export class LambdaEndpoint
  extends DomainEntity<LambdaEndpoint>
  implements LambdaEndpoint
{
  public static primary = ['slug'] as const;
  public static unique = ['service', 'access', 'function'] as const;
}
