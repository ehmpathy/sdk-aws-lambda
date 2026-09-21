# F2 — the util is named `runLambdaEndpoint.onReferenced`

> ✅ **RULED by the wisher, 2026-09-08.** briefed at
> `.agent/repo=.this/role=any/briefs/define.lambda-endpoint-run-boundary.md`.

## the verdict

```ts
runLambdaEndpoint.onSerialized({ which, event, at: 'cloud' | 'local' })
runLambdaEndpoint.onReferenced({ handler, event })   // no `at` — none is possible
```

## the fork, stated fairly

the wish reserves the name for the maintainer and offers two gerund proposals, both blocked by
`rule.forbid.gerunds`. it names the property to keep: the name must read as *in-process* and
*endpoint-aware*, so it cannot be confused with the over-the-wire path.

the candidates weighed, and where each died:

| candidate | why it lost |
|---|---|
| `invokeHandlerForTest` | already exists at `src/__test_assets__/invokeHandlerForTest.ts:9`, but "handler" is not the sdk's word and the name is not endpoint-aware |
| the wish's two gerund proposals | `-ing` gerund — `rule.forbid.gerunds`, blocker |
| `askLambdaEndpointForTest` | ⚠️ **the drive's own best-guess, and wrong** — see below |
| `askLambdaEndpoint.forTest` | a dot promises *same operation, variant mode*. these disagree on args, how they address the endpoint, context, **and the error stance**. it would also forfeit the tree-shake F4 leans on — no `sideEffects` field in `package.json`, zero `x.y =` attach precedent in `src/` |
| `askLambdaHandlerForTest` | avoids the confusion; does not **teach** the distinction |
| **`runLambdaEndpoint.{onSerialized,onReferenced}`** | ✅ **taken** |

## 🔴 the drive's guess was wrong, and the old entry predicted exactly how

the prior best-guess was `askLambdaEndpointForTest`, at 72% — the second-lowest confidence on the
board. its own text named the objection that later landed:

> *"a maintainer who reads `ask` as inherently remote (you ask another service; you do not ask a
> function in your own process) has a fair objection"*

⇒ **that is the objection the wisher raised.** the low confidence was earned, and the reason
recorded under it was the right reason. `rule.always.itemize-the-fulcrums-you-best-guess` asks for
*"confidence, and why it is low"* precisely so a council can find the live fork fast; here the
record did its job.

## why the verdict beats the guess

**1 — `run` vs `ask` is a contract distinction, not a synonym.**

| verb | the stance | a constraint error |
|---|---|---|
| `ask` | you want **an answer** | **throws** — hydrated at `getParsedResponse.ts:52-108` |
| `run` | you want **what happened** | **returns** the envelope, as-is |

⇒ fulcrum **F1** — the drive's sharpest discovery, that the util is a faithful pass-through rather
than a never-throw — is promoted from a paragraph of prose into the vocabulary. an author who
writes `run` has already been told what comes back.

**2 — it retires Q8's deterrence risk.** `…EndpointForTest` reads endpoint-bound, so the actor the
util most serves — 19 of 20 repos, 314 of 318 sites, still on `createStandardHandler` (**F7**) —
was the one most likely to skip it. `runLambdaEndpoint` makes no such claim.

**3 — the two subdomains split on a causal axis.** the boundary determines the error stance; the
locus does not. `invokeLambdaForTestingLocally.ts:99` converts the envelope to a throw on the
**local** locus, and its own comment at `:78` says why — *"make the response look like what
aws-lambda would return"*. so the split names the property that predicts behavior.

**4 — the barred cell becomes unrepresentable.** `referenced × cloud` is impossible by nature (a
function reference cannot cross a process), and `onReferenced` takes no `at` parameter, so it
cannot be written. `rule.prefer.prevent-over-correct`, rung 1.

## what the verdict cost

it **near-doubled the product — to 176 cells, 69 reachable experiences** — and added a fifth axis
(D5) the walk had never declared: every one of the first 80 cells was implicitly at `referenced`.

it also added a **sixth outcome-state**, `resolution-failure`, reachable only on the serialized
boundary — which is why the two halves are *not* symmetric (96 cells / 49 reachable, against 80 /
41) and why their reachable counts do not sum (21 of the 49 are the same experience met from
another direction).

three new critipaths were demoed as a result — case=8, case=9, case=10; see the inventory.

⚠️ **this section read *"doubled to 160 cells"* until i015.** the sixth outcome-state is named in
its very next sentence, and a sixth state cannot leave the halves cell-for-cell equal — so the
count was falsified by the line beneath it.

## rework

**clean** — a rename while open, settled now.

## where

- the public export surface
- every demo in this vision (17 sites, swept 2026-09-08)

## the verdict

**ruled: `runLambdaEndpoint.{onSerialized, onReferenced}`.** closed.
