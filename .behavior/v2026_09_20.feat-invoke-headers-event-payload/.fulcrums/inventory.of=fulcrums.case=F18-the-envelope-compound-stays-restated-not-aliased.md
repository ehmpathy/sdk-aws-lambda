# F18 — the envelope's compound type stays RESTATED, not extracted to an alias

- **rework**: clean
- **status**: open — best-guessed, itemized, driven on
- **confidence**: 91%
- **where**: `genLambdaEndpoint.forApiGateway.ts:175-180`, `:271-274`; raised i006 r011
  (`enroll-impl-arch-defects`), nitpick 2

## .the fork, stated fairly

the compound `UnifiedApiGatewayEvent<{ headers: ApiGatewayHeadersMerged<THeaders>; payload:
TPayload }>` is written out **twice** in one file — once as `invoke`'s `event` parameter, once as
`logic`'s.

| | |
|---|---|
| **A — extract an alias** | one model, one statement. the reviewer's own words: *"collapses the drift surface for the next field this shape grows."* and the repo's briefs do warn against a model stated twice in one document |
| **B — leave both restatements** | two usages is below the rule of three, no candidate name survives the container-word test, and — the half that settled it — the two sites are joined by a **compile-checked assignment**, so they cannot drift |

## .taken: B — leave it. and why, at the time

🔴 **the reviewer's stated risk is the one half I could falsify.** they wrote *"currently in sync
only because one author wrote all three in one PR."*

`genLambdaEndpoint.forApiGateway.ts:304-311`:

```ts
const response = await config.invoke(
  { headers: eventFrozen.headers, payload: eventFrozen.payload, event: eventFrozen },
  { log },
);
```

`logic`'s `event` flows **directly into** `config.invoke`'s `event`. change one restatement and not
the other and `tsc` fails at this call, on every `--what types`. ⇒ they are in sync by the type
checker, never by authorship.

⚠️ and that is precisely the distinction `rule.require.retest-the-model-on-every-family` draws. its
blocker is *"one member of a model stated as two different types in one document"* — and its danger
is that the two statements **cannot be lined up**. here they are lined up mechanically.

### the second half — no name fits

`rule.forbid.ungrounded-type-params`'s test: *"try to name [it] three ways. if every candidate is
container-jargon or a rule break, there is usually no concept there."*

| candidate | verdict |
|---|---|
| `ApiGatewayEventForPair` | `Pair` names this type's own container, never the value |
| `ApiGatewayEventConstrained` | a quality-word — the class that rule names |
| `UnifiedApiGatewayEventBound` | same, plus it reads as a middy bind |

⇒ the alias buys a name to maintain and hides no complexity the compiler does not guard.

⚠️ **and the reviewer's count is 3 where the truth is 2.** the third site they cite, `:132`
`FrozenDeep<ApiGatewayHeadersMerged<THeaders>>`, is the **headers slot alone** — the proposed alias
would not collapse it. that matters: at 3 restatements the rule of three is met and A wins.

## .why the rework is CLEAN

the extraction is a type alias and two substitutions in one file. no consumer names either type, no
behavior moves, and `tsc` proves the swap. ⇒ a council that rules A costs one edit.

## 🔴 .why the confidence is 91% and not higher

one reason, stated rather than hidden: **the refutation rests on a property a future refactor can
remove.** if `logic` ever stops to hand its `event` straight to `config.invoke` — a projection, a
wrapper, a second transform — the compile-checked link is gone, and with it the whole of B's case.

⇒ **the trigger is recorded so the next traveler inherits it rather than re-derives this refusal**:

> **B holds while (a) the count is 2, and (b) the two sites are joined by a direct assignment.**
> break either and the answer flips to A.

## 🔴 .the trigger FIRED one round later — on a PEER subject, not on this one

i007/r011 raised the **header bound** (`Record<string, string | undefined> | undefined`) under the
same rubric. I ran the trigger above against it and both conditions broke at once:

| the condition | this subject (the compound) | the peer (the bound) |
|---|---|---|
| (a) the count is 2 | ✅ 2 | ⛔ **3 bounds — and the subject sweep turned up 7 textual copies in all** |
| (b) joined by a direct assignment | ✅ `logic`'s `event` flows into `config.invoke`'s | ⛔ **one site is a separately-importable public export**, reachable with no `forApiGateway` call at all — and `[case20]`, the clamp, enters through `forApiGateway` |

⇒ **so the peer took answer A and this subject keeps B**, and that split is the point: the trigger
discriminated rather than merely predicted. the bound is now `ApiGatewayHeadersDeclared`, defined
once; the compound stays restated twice.

🔴 **and r011 drew the same line independently**, in the very round that raised the peer: *"the
`{ headers?: THeaders; payload: TPayload }` schema shape is only 2-site and directly coupled … so
it doesn't cross the same threshold."* ⇒ the refutation held under a reviewer who had every reason
to extend their own find to it.

## .the record

- the disposal: `…i006.01805c825469b2d042.r011._.taken.by_self.enroll-impl-arch-defects.md`,
  nitpick.2 — the only `[REFUTE]` of that round
- the trigger's first trip: `…i007.14c7dabe469d6ad59e.r011._.taken.by_self.enroll-impl-arch-defects.md`,
  nitpick.1 — a `[REPAIR]`, taken **because** of the trigger written here
- ⚠️ the reviewer was right about the observation and wrong about the mechanism, which is why this
  is a fulcrum rather than a flat refusal: a council may reasonably prefer the alias anyway, on
  readability grounds this refutation does not address

## .the verdict

_unruled — open for the fulcrum council._
