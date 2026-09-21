# F17 — the ancient-caller fixture stays, as a raw-wire instrument

- **rework** = clean
- **status** = open
- **confidence** = 93%
- **raised** at i011 r011 + i012 r010, both of which asked for the file's deletion

## the fork, stated fairly

two reviewer lanes independently found that `src/__test_assets__/askLambdaEndpointAncient.ts` built
its **own** `LambdaClient`, its **own** `InvokeCommand`, and reached aws on a credential chain the
sdk did not own. both proposed the same remedy:

> *"replace `askLambdaEndpointAncient` calls in the roundtrip test with
> `runLambdaEndpoint.onSerialized({ …, at: 'cloud', struct: { payload: 'ancient' } })`, then delete
> the hand-rolled file."*

| option | what it costs | what it leaves |
|---|---|---|
| **A. swap and delete** — the proposed remedy | one import swap, one file deleted | ⛔ **`[case2]`'s clamp is destroyed** — see below |
| **B. repair the drift, keep the instrument** ← **taken** | two lines: reach `genLambdaSdk` + `sdkLambdaInvoke` | the fork is gone AND the clamp survives |
| **C. keep it as-is** | zero | the second credential chain the guard exists to bar |

## why B, and the measurement that settles it

**the two are NOT interchangeable, and the reviewer anticipated exactly this:**

> *"If the two are ever found **not** interchangeable (e.g. a real behavioral gap in ancient-dialect
> error hydration on the cloud locus), that gap is itself worth a fulcrum."*

it is that gap, and it sits on the caller's read rather than on the wire.

`getParsedResponse.ts:84-97` hydrates an ancient `BadRequestError` envelope into a `ConstraintError`
and does **not** forward `errorType` — compare `:101-107`, the non-constraint branch, which does. so
the swap flips both of `[case2]`'s assertions:

| assertion | via the fixture | via `onSerialized` |
|---|---|---|
| `caught instanceof LambdaEndpointError` | ✅ true | ❌ false — it is a `ConstraintError` |
| `metadata.errorType === 'BadRequestError'` | ✅ | ❌ `undefined` — consumed by the hydration |

🔴 **and the datum is not merely relocated — it is gone.** after hydration a contemp-envelope and an
ancient-envelope constraint error are **both** `ConstraintError`, so the one fact `[case2]` exists to
prove — *the contemp handler chose the ancient dialect because the payload arrived unwrapped* — is no
longer observable at any field.

the only residue is `metadata.stackTrace` (`:95`, absent on the contemp branch at `:59-64`). an
assertion on that reads a **byproduct** rather than the fact, which is the no-teeth shape
`rule.require.clamp-edge-cases` bars — and which this same round caught twice by bite-probe.

⇒ **the fixture is a raw-wire instrument, and the sdk's callers are deliberately not.** a test that
asks *"what did the handler put on the wire?"* cannot use a caller whose contract is to hydrate that
wire away.

## what B actually repaired

the drift the lanes named is real and is fixed. the fixture now reaches the sdk's own two modules:

```ts
const response = await sdkLambdaInvoke(
  { slug: endpoint.slug, payload: input.event },
  { sdkLambda: genLambdaSdk({ env: { region: context.env.region } }) },
);
```

⇒ so it shares the **credential chain** and the **wire address** with the runtime path, and forks
only the **response read** — which is the one half it must fork to be the instrument at all.

## 🔴 the sharper half — the guard was blind, and that is now closed

both lanes noted that `[case9] [t3]` walks the import graph from `runLambdaEndpoint.ts`, so a peer
module that no file in that graph imports is invisible to it. **that blindness is the more valuable
catch than either nitpick**, because it is a property of the guard rather than of one file.

`[t4]` is added: the same claims, over the whole `src/` tree, minus `.test.ts`.

✅ **bite-probed** — restore `new LambdaClient` + `new InvokeCommand` in the fixture and `[t4]` goes
red on both, while `[t3]` stays green. that green is the direct proof of the blindness claim.

⚠️ **and `[t4]`'s first run surfaced two forks no one had probed** — `getAllLambdaContracts.ts:51` and
`createInProcessLambdaHarness.ts:135-139` both speak the slug convention. caught as
`.dream/v2026_09_10.repair.the-slug-convention-has-three-speakers.md`; the write-side fix wants a new
public transformer, which fails CLEAN on this round.

## the rework, and why it is clean

reversal is a delete plus an import swap in one test file, and the `[t4]` row would have to be
re-cut. no consumer depends on the fixture — it is `__test_assets__` and unexported from the barrel.

## where

- `src/__test_assets__/askLambdaEndpointAncient.ts` — the instrument, and the docblock that argues this
- `src/__test_assets__/askLambdaEndpoint.roundtrip.integration.test.ts` — its one consumer
- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.credentialchain.integration.test.ts` `[t4]` — the guard that closes the blindness

## the verdict, once ruled

— open —
