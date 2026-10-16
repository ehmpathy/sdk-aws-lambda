# F12 — a leaf transformer holds its own pipeline; and other points the level-4 reviewers raised

## .the fork

`rule.forbid.inline-decode-friction` bars decode-friction in an ORCHESTRATOR. three level-4 blockers
(`mech-decode-friction` r3, blockers 3, 4, 5) point it at LEAF TRANSFORMERS: `getOneBodyFromHttpText`,
`asCorsHeadersWithTrail`, and `asHeadersWithoutKey`.

- A. extract a helper under each transformer (`getOneOrNullFromParsed`, `getListedCorsHeaders`,
  `isKeyWithoutCaseVariant`)
- B. keep each as one named transformer whose body is the pipeline

## .taken = B, and why at the time

`define.domain-operation-grains` puts decode-friction INSIDE the transformer: a transformer is the grain
that exists to hold a pipeline under one name, and the orchestrator that calls it reads as a narrative.
each of the three has a domain name (`getOneBodyFromHttpText`, `asHeadersWithoutKey`,
`asCorsHeadersWithTrail`), a data-driven unit test, and one caller line. a helper under a transformer is
a transformer under a transformer, which the grain brief does not ask for, and each helper would name a
step (`isKeyWithoutCaseVariant`) with no second caller (`rule.prefer.wet-over-dry`).

the two orchestrator points (blockers 1 and 2) were taken: `asHttpRequestHeaders` now holds the header
merge, and `asCarriedPayload` takes the optional trail itself so `onReferenced` holds one call.

## .the other points refuted in the same round

| point | answer |
|---|---|
| r8 blocker.1: the snapshot omits a denylist of headers | the denylist names only the four volatile or transport keys (`date`, `connection`, `keep-alive`, `content-length`); every other key the answer holds is pinned. the reviewer's own fix is "denylist only the volatile fields", which is the code. `rule.require.snapshots-deny-volatile-not-allow-expected` asks for exactly this |
| r8 nitpick.1: `ConstraintError` for a bad exid | the caller of `asApiGatewayHeaders` is a developer who passed a value the sdk cannot send; that is a caller fault in this sdk's own vocabulary (`rule.require.failloud`: caller must fix). the function is not routed through an error builder that answers an http caller |
| r8 nitpick.2: `Reflect.get` on an object | the value comes from `JSON.parse` in the one call path; arrays and class instances carry no `correlationId` and read `null` |
| r8 nitpick.4: the readme row | the row already holds the api gateway exception inline |
| r6 nitpicks 1, 2, 3, 4, 6; r1 nitpick.1; r4 nitpick.1; r5 nitpick.2 | each states its own "no change owed", points at code that holds what it asks for (a `.cast / .why / .removal` block on the `TResponse` cast, an early return and a ternary in `asHttpMethod`, the `seen` array declared inside each `given`, the denylist form already landed), or restates a recorded decision (F10: no `entries()` under this tsconfig; parse faults read as `null` because `text` keeps the raw answer) |
| level-5 r10 nitpick.3: `onSerialized` at local and `viaApiGateway` are covered by assertion, with no snapshot | the other shapes of the same files are snapped where the output is a contract an author reads (the http caller's answer and errors, in `local.askApiGateway.acceptance.test.ts`; the default-dialect api gateway journey, in `local.sdkContract.acceptance.test.ts` `[case20]`). an assertion on the sent payload (`[case21]`) is the sharper check for a payload a snapshot would pin whole, volatile header values included |
| level-5 r11 nitpick.2: `asCarriedPayload` is named `as*` and mints | the `getOneTrailWithExid` mint is the one place a header owes a value; the cloud branch mints once and passes it in, so the transformer's mint fires only on the local road, where the caller gave none. a pure cast would push a second mint site into `onReferenced` |
| level-6 r10 nitpick.1: no test shows the refusal text reach a log through the runner | the stamp means `onReferenced` and the local locus no longer reach the refusal; the text is pinned where it is owned, by the middleware snapshot. a test through the runner would pin console output the sdk does not own |
| level-6 r11: one `Record<TrailCarrier, { read, write }>` for a third carrier | the peer says not to build it at two carriers; `rule.prefer.wet-over-dry` agrees |
| level-6 r11: the mark constant lives in the setter file | the setter and its reader are two files of one mechanism, and the reader imports the constant from its setter; a move beside `TRAIL_EXID_HEADER` puts a symbol beside a header name |
| level-6 r11: `asCarriedPayload` reads an unfolded bag, the receiver a folded one | the receiver folds the bag it is handed; an `X-Trail-Exid` on a hand-built v1 event reads as absent on the sender side and is replaced by a generated or given exid, which `[t3]` of its test pins. the builder's lowercase header is the documented form |
| r11 nitpick: `Object.assign` makes `askLambdaEndpoint === viaInvoke` | the family-object shape is the extant `genLambdaEndpoint` shape (`rule.forbid.unqualified-variant-exports`), taken on the wisher's word that this is how the family already works; a thin wrapper would split the callable from its family |

## .rework = clean

each is a local edit, and none moves a public contract.

## .confidence = 80%, low because

- the grain brief is the architect's, and a mechanic reviewer reads the rule beside it without that
  brief; the two roles may weigh a leaf pipeline differently

## .verdict

open — for the fulcrum council.
