# rule.require.contemp-must-self-identify

## .what

a **contemp** value must identify itself explicitly. a value that does not is
**ancient** — never the other way round.

so every contemp/ancient fork resolves in one direction:

```ts
// 👍 test for contemp; every other value is ancient
if (getIsContempErrorTagged(value)) return asContemp(value);
return asAncient(value);

// 👎 test for ancient; every other value is contemp
if (looksAncient(value)) return asAncient(value);
return asContemp(value);   // an unknown value is now claimed as ours
```

## .why

we author **each** contemp producer. ancient predates this sdk and we author none
of them.

⇒ so a value we do not recognize was **not** written by a contemp producer, by
construction. to claim it as contemp is to assert authorship we do not have.

and the two fall-through directions are not symmetric:

| the fallback | what it assumes | what it costs when wrong |
|---|---|---|
| **ancient** | the value carries no wrapper and no tag | a contemp value read flat — fields read `undefined`, loud on the first assertion |
| **contemp** | the value carries our wrapper AND our tag | an ancient value narrowed to a type it lacks — `.error.message` reads `undefined`, **no throw** |

⇒ **ancient assumes less, so it fails louder.** that is the whole argument.

🔴 and the contemp side is FREE to make explicit, because we control it. an ancient
producer cannot be asked to stamp a tag — it shipped years ago. a contemp producer
is ours, so the stamp costs one literal.

## .how

- **give contemp a discriminator it stamps on itself** — a versioned serde tag, a
  wrapper key, an explicit enum value. whatever a reader can test for.
- **test for that discriminator, and treat its absence as ancient.** never test the
  ancient shape and fall through to contemp.
- **match the stable PREFIX of a versioned tag**, never the full literal — an
  equality check stops to recognize the next codec version, silently.
- ⚠️ **an ABSENT value is not an unrecognized one.** a documented default may be
  contemp; an unrecognized value may not.

## .examples

### 👍 the error envelope

`LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP` stamps `LambdaEndpointError::contemp@v1`, and
`getIsContempErrorTagged` matches its prefix. no tag ⇒ not contemp. the ancient
narrow then reads the flat `{ errorMessage, errorType }` shape and is honestly
labelled a heuristic — the ancient wire has no tag to stamp.

### 👍 the caller's dialect

`askLambdaEndpoint` branches on `structOfPayload === 'contemp'`, so an unrecognized
dialect sends the event FLAT rather than wrapped. a fall to contemp would wrap a
payload for a handler that never learned to unwrap it.

### 👎 the inverted branch

```ts
const payload = structOfPayload === 'ancient'
  ? input.event
  : getLambdaPayload({ event, trail });   // 'contmep' is now contemp
```

## .enforcement

- a contemp/ancient fork whose fall-through lands on contemp = **blocker**
- a contemp producer with no discriminator a reader can test for = **blocker**
- a versioned tag compared by equality rather than by prefix = **blocker**
- a documented default that resolves to contemp = **false positive**

## .see also

- `invariant.ancient-vs-contemp-callers` — why two dialects exist at all
- `rule.require.contemp-contracts-default` — contemp is the DEFAULT; this rule
  governs the UNRECOGNIZED case, which is a different question
- `rule.forbid.failhide` (ehmpathy/mechanic) — the silent narrow this prevents
