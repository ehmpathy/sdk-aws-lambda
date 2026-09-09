import { withAssure } from 'type-fns';

import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import { getAllWirePayloadKeysFound } from './getAllWirePayloadKeysFound';

/**
 * .what = checks that a value is an ApiGatewayResponse — an object with at least one of
 *         status, headers, or body, and none of the aws wire-payload keys
 * .why = the type refuses `{}` at compile time, but a handler's return crosses an
 *        `unknown` boundary at run time (a js caller, an `any`, a cast). this is the
 *        runtime backstop for the invariants the type holds
 *
 * .note = it checks CARDINALITY and FOREIGN KEYS, not field types. the field types are
 *         `schema.output`'s job; this exists so an empty, non-object, or wire-shaped return
 *         fails loud HERE rather than reach middy's `statusCode ??= 500` and emit a silent 500
 *
 * .note = the foreign-key half closes a MIGRATION hazard the cardinality half could not see.
 *         `{ statusCode: 404, body: JSON.stringify(x) }` — the aws-native shape, and the one
 *         the wish's own `.ground` evidence used — satisfies `'body' in input`, so it used to
 *         pass. it then lost its 404 to `status ?? 200` and had its body encoded twice
 *         (rule.forbid.failhide)
 */
export const isApiGatewayResponse = withAssure(
  (input: unknown): input is ApiGatewayResponse<unknown> => {
    // reject a non-object; a response is always an envelope
    if (typeof input !== 'object' || input === null) return false;

    // reject an array; api gateway has no array response shape
    if (Array.isArray(input)) return false;

    // reject the aws wire shape; no step here reads its keys, so they would vanish
    if (getAllWirePayloadKeysFound({ response: input }).length) return false;

    // require at least one of the three fields — this is what PickAny encodes
    return 'status' in input || 'headers' in input || 'body' in input;
  },
  { name: 'isApiGatewayResponse' },
);
