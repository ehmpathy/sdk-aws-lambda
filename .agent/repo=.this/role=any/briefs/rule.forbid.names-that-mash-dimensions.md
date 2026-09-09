# rule.forbid.names-that-mash-dimensions

## .what

a name must not concatenate two **orthogonal dimensions** into one token, as if their product
were a domain concept.

`forApiGatewayWire` mashes **trigger** (api gateway) with **response mode** (wire). no platform
is named "ApiGatewayWire", so the token names a concept that does not exist.

## .why

- **the reader hunts for a concept that is absent.** a name reads as one unit; the reader looks
  for that unit in the domain and does not find it (`rule.require.ubiqlang` — a term must name a
  concept the domain holds).
- **the product grows combinatorially.** add a third dimension and you owe
  `forApiGatewayWireCors`. the name has no stable end, so each new axis forces a rename or a
  fourth export.
- **it hides the real question.** once "ApiGatewayWire" reads as a unit, no one asks whether the
  *wire* dimension belongs in a name at all — which was exactly the question that dissolved two
  fulcrums in the case that produced this rule.

## .the test — for the proposer

split the proposed name into its parts, then ask of each pair: **"do these two vary
independently?"**

| parts | vary independently? | verdict |
|---|---|---|
| `Iso` + `Price` | no — `Iso` qualifies `Price` | fine, one concept |
| `Stripe` + `Customer` | no — a customer as stripe holds it | fine, one concept |
| `Lambda` + `Endpoint` | no — an endpoint of a lambda | fine, one concept |
| `ApiGateway` + `Wire` | **yes** — any trigger could want any response mode | **mash; do not name it** |

when two parts vary independently, exactly **one** of them belongs in the name. the other belongs
in a type, a field, or a value.

## .the test — for the reviewer

read every new multi-part name aloud and ask the domain question: **"would a domain expert
recognize this as one concept?"** if the answer needs a gloss — "well, it is the api-gateway one,
but in wire mode" — the name mashed two dimensions.

a second tell: **the proposal explains the name.** a discovered name needs no explanation
(`def.domain-discovery` — a discovered term is recognized with no gloss).

a third tell: the parts of the name map onto axes the proposal itself lists as separate concerns
elsewhere in the same document.

## .the fix — promote the independent dimension out of the name

| 👎 mash | 👍 one dimension in the name |
|---|---|
| `forApiGatewayWire` | `forApiGateway` returns `ApiGatewayResponse` — the mode lives in the type |
| `getOneUserByEmailCached` | `getOneUser({ by: { email } }, { cache })` — the cache lives in context |
| `setInvoiceDraftXml` | `setInvoiceDraft({ format: 'xml' })` — the format lives in a value |
| `delVpcForceRegionUsEast` | `delVpc({ vpc }, { env: { region } })` + `{ force: true }` |

the receiver of the promoted dimension follows the extant grain: ambient runtime goes to
`context`, a caller choice goes to `input` or a value, a shape choice goes to the type.

## .the caveat

a name may hold two parts that look like axes but are not, because one **qualifies** the other
and cannot vary alone. `IsoPriceWords` is not a mash: `Words` is a representation *of* an
`IsoPrice`, and there is no separate "words" axis that any other noun could take. the test is
independence, never the count of parts.

## .enforcement

- a new name whose parts name two independent dimensions = **blocker**
- a name that needs a gloss for a domain reader = **nitpick**
- a name whose next extension would append a third dimension = **blocker**
- a multi-part name where one part qualifies the other = false positive

## .see also

- `rule.require.ubiqlang` (mechanic) — a term must name one concept the domain holds
- `rule.require.treestruct` (mechanic) — `[verb][...noun]` / `[...noun][state]`; a mash breaks the noun hierarchy
- `howto.dimensional-decomposition` (architect) — the axes this rule keeps out of names
- `def.domain-discovery` (architect) — a discovered name is recognized with no gloss
- `rule.require.widen-before-parallel` — a mashed name is often the tell of a needless peer
