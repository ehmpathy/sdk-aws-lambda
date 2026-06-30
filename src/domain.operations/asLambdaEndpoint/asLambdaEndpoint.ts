import { UnexpectedCodePathError } from 'helpful-errors';

import { LambdaEndpoint } from '../../domain.objects/LambdaEndpoint';

/**
 * .what = builds a LambdaEndpoint from either its natural-key parts or its slug
 * .why = one boundary transformer for the endpoint concept; parse the slug string
 *        exactly once here, pass the structured entity everywhere else
 *
 * .forms
 *   - asLambdaEndpoint({ service, access, function }) → computes slug
 *   - asLambdaEndpoint({ slug }) → strict-parses slug into parts
 *
 * .throws UnexpectedCodePathError — slug does not match '{service}-{access}-{function}'
 *   (exact 3-part shape; no partial match)
 */
export const asLambdaEndpoint = (
  input:
    | { service: string; access: string; function: string }
    | { slug: string },
): LambdaEndpoint => {
  // form 1: parts → entity (compute slug)
  if ('service' in input) {
    return new LambdaEndpoint({
      service: input.service,
      access: input.access,
      function: input.function,
      slug: `${input.service}-${input.access}-${input.function}`,
    });
  }

  // form 2: slug → entity (strict parse)
  // slug shape: 'svc-{noun}-{access}-{function}' where service is 'svc-{noun}'
  // so the first two dash-parts form the service, the third is access, the rest
  // (joined) is the function — which may itself contain dashes
  const parts = input.slug.split('-');
  if (parts.length < 4 || parts[0] !== 'svc') {
    throw new UnexpectedCodePathError(
      `slug does not match expected '{service}-{access}-{function}' shape`,
      { slug: input.slug },
    );
  }

  const service = `${parts[0]}-${parts[1]}`;
  const access = parts[2] as string;
  const func = parts.slice(3).join('-');

  return new LambdaEndpoint({
    service,
    access,
    function: func,
    slug: input.slug,
  });
};
