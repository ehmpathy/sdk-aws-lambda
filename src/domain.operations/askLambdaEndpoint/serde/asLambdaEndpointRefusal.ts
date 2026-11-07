import { MalfunctionError } from 'helpful-errors';

import {
  type LambdaEndpointRefusal,
  REFUSAL_DEFAULT,
  REFUSAL_PASSTHROUGH,
} from '../../../domain.objects/LambdaEndpointRefusal';

/**
 * .what = casts a declared `refusal` opt into one this sdk can honor, and refuses any other
 * .why = the cast branches on one literal, so a typo or a config-driven value
 *        (`{ as: 'constraintError' }`) would fall to the default class, and the thrown message
 *        would then tell the caller to set the very opt they believe they set. a published sdk
 *        boundary is validated at runtime or it is not validated (rule.forbid.unexpected-defaults),
 *        as `asLambdaEndpointDialect` does for its peer field
 *
 * .note = refused at the ask, before any request is sent, so a bad opt fails on the first call —
 *         never only on the first peer refusal, which may come weeks later
 */
export const asLambdaEndpointRefusal = (input: {
  declared?: unknown;
}): LambdaEndpointRefusal => {
  // absent is legal: the asker composed the request
  if (input.declared === undefined || input.declared === null)
    return REFUSAL_DEFAULT;

  // a known class is honored as given
  const as =
    typeof input.declared === 'object' && 'as' in input.declared
      ? input.declared.as
      : undefined;
  if (as === 'ConstraintError') return REFUSAL_PASSTHROUGH;
  if (as === 'LambdaEndpointRefusedError') return REFUSAL_DEFAULT;

  // any other value is refused, with both options named. the asker's own code composed the opt,
  // so it is the asker's defect, never its caller's: a ConstraintError here would answer that
  // caller a 400 it cannot fix (sdk-aws-lambda#77), as `asLambdaEndpoint` refuses a bad slug.
  // MalfunctionError, not its parent UnexpectedCodePathError: only the child prints a `💥` header
  return MalfunctionError.throw(
    'the refusal opt given is not one this sdk can honor',
    {
      declared: input.declared,
      options: [
        { as: 'LambdaEndpointRefusedError' },
        { as: 'ConstraintError' },
      ],
      hint: "omit `refusal` when this caller composed the request (a peer refusal is then a LambdaEndpointRefusedError, a server fault). pass `refusal: { as: 'ConstraintError' }` only where the request forwards your own caller's input verbatim.",
    },
  );
};
