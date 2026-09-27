import { withAssure } from 'type-fns';

import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import { getAllResponseOnwireKeysFound } from './getAllResponseOnwireKeysFound';

/**
 * .what = checks that a value is an ApiGatewayResponse — an object with at least one of
 *         status, headers, or payload, and none of the aws response-wire keys
 * .why = the type refuses `{}` at compile time, but a handler's return crosses an
 *        `unknown` boundary at run time (a js caller, an `any`, a cast). this is the
 *        runtime backstop for the invariants the type holds
 *
 * .note = it checks CARDINALITY and FOREIGN KEYS, not field types. the field types are
 *         `schema.output`'s job; this exists so an empty, non-object, or wire-shaped return
 *         fails loud HERE rather than reach middy's `statusCode ??= 500` and emit a silent 500
 *
 * .note = the foreign-key half closes a hazard the cardinality half cannot see.
 *         `{ statusCode: 404, body: JSON.stringify(x) }` — the aws-native shape — satisfies the
 *         cardinality half, then loses its 404 to `status ?? 200` and has its body encoded twice
 *         (rule.forbid.failhide)
 *
 * .note = `body` is a foreign key, since the envelope's body slot is `payload`, and
 *         `asApiGatewayResponseOnwire` reads `'payload' in response` — so it would drop a `body`
 *         with no word. the foreign-key half turns that silent drop into a throw that names the fix
 */
export const isApiGatewayResponse = withAssure(
  (input: unknown): input is ApiGatewayResponse<unknown> => {
    // reject a non-object; a response is always an envelope
    if (typeof input !== 'object' || input === null) return false;

    // reject an array; api gateway has no array response shape
    if (Array.isArray(input)) return false;

    // reject the aws wire shape; no step here reads its keys, so they would vanish
    if (getAllResponseOnwireKeysFound({ response: input }).length) return false;

    // require at least one of the three fields — this is what PickAny encodes
    return 'status' in input || 'headers' in input || 'payload' in input;
  },
  { name: 'isApiGatewayResponse' },
);
