# F22 — the contemp envelope stamps its CODEC version, and that is what closes F19/F20

| field | value |
|---|---|
| **rework** | clean |
| **status** | ✅ **RULED** by the wisher 2026-09-13, and ✅ **IMPLEMENTED** 2026-09-13 — types, format, lint, unit (556) all green; both clamps bite-proven |
| **confidence** | — (ruled) |
| **raised** | 2026-09-13, by the wisher, while F19/F20 were escalated for a council call |
| **where** | `domain.objects/LambdaEndpointErrorResponseBody.ts` (the tag), `domain.operations/lambdaEndpointWire/error/getIsContempErrorTagged.ts` (the detector), `domain.operations/runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts` (the dialect-fixed narrows) |

## the ruling

> *"we should always say the codec (encode, decode) version ; i.e., `sdk-aws-lambda@vxyz`. commit
> hash is even better … but version must be included at the least. contemp has version; ancient does
> not."*

⇒ the tag stops to be a bare literal and becomes a **codec identifier**:

```ts
// before — it says WHO wrote it
_serde: 'LambdaEndpointError::contemp'

// after — it says who wrote it AND WITH WHICH CODEC
_serde: 'LambdaEndpointError::contemp@0.4.0'
```

## 🔴 why this is the answer to F19/F20, rather than a feature beside them

the council question was: *may a classification rest on a **declaration** or a **shape**, where an
authoritative signal exists or could?*

**the wisher's answer makes the signal EXIST on the boundary that had none.** F19's whole defense —
*"the ambiguity is inherent to the ancient wire, so no classifier can do better"* — was true, and it
was an argument about the **ancient** dialect. it was never an argument about contemp, and the code
had applied it to both:

```ts
// isLambdaEndpointErrorEnvelope.ts:66-73 — :69 executes even when the caller declared contemp
if (getIsContempErrorTagged(output)) return true;
const ancient = output as { errorMessage?: unknown; errorType?: unknown };
return typeof ancient.errorMessage === 'string' && typeof ancient.errorType === 'string';
```

⇒ **a contemp-declared caller inherits an ambiguity that belongs to a dialect they did not declare.**
the stamp makes the contemp branch exact and the shape fallback unnecessary on that branch.

## the rule the stamp licenses

> **no tag → not a contemp envelope.** exact, never a heuristic.

and it is **better on the mismatch**, not merely simpler:

| declared | value | today | under the rule |
|---|---|---|---|
| contemp | contemp | ✅ | ✅ |
| contemp | **ancient** | 🔴 `:69` matches → narrows to a type the value lacks → `.error.message` reads **`undefined`, silently** | ✅ guard returns false → `asLambdaEndpointErrorEnvelope` **throws** a `ConstraintError` |
| ancient | any shape | shape heuristic — genuinely ambiguous | unchanged. the ancient wire has no tag to stamp |

⇒ it converts a live failhide (`rule.forbid.failhide`) into a loud fault. **that is a repair, and the
version stamp is what makes the exactness durable rather than merely present.**

## 🔴 the correction the directive needs — `sdk-environment`'s commit is the SERVICE's, not the CODEC's

> *"commit hash is even better, cause sdk-environment already stamps the commit on there. upgrade to
> latest sdk-environment if needed"*

**verified, and the upgrade is not owed: `sdk-environment@0.1.5` IS latest** (`npm view` → `0.1.5`),
and it is already a direct dependency (`package.json`). so no install is needed.

⚠️ **but its `commit` answers a different question than the directive asks.** read at source:

```ts
// sdk-environment readme
interface Environment {
  access: 'test' | 'prep' | 'prod';
  server: string;   // 'cloud@aws.lambda' | …
  commit: string;   // '$gitref@$hash' — of the process that executes
}
```

| the question | answered by |
|---|---|
| *"how do I decode this envelope?"* | the **codec** version — `sdk-aws-lambda@0.4.0`. this is the directive's stated ask |
| *"what code produced this error?"* | `environment.commit` — e.g. `svc-home-services@a1b2c3d` |

⇒ `environment.commit` is the **consumer service's** git ref, because `getEnvironment()` resolves
against the process that executes. a service on `main@i7j8k9l` that depends on `sdk-aws-lambda@0.4.0`
stamps the former and tells a decoder naught about the latter.

🟡 **so the two are complements, never substitutes**, and the ruling's own floor is the one that
matters: *"version must be included at the least."* the codec version is the load-bearing half —
it is what a decoder branches on. the service commit is debug provenance, and it is genuinely *"even
better"* **beside** the version rather than instead of it.

## what ships

| # | the change | grade |
|---|---|---|
| 1 | `_serde` carries the codec version — `LambdaEndpointError::contemp@$version` | ✅ clean |
| 2 | the contemp branch of the narrow rests on the tag ALONE; `:69` no longer executes under a contemp declaration | ✅ clean — and it closes a failhide |
| 3 | the detector accepts a **version range**, never an equality — an old envelope must still decode | ✅ clean, and **required**; see below |
| 4 | `environment.commit` added beside the version, as debug provenance | 🟡 optional, and priced below |

### 🔴 #3 is not optional, and it is where a naive stamp breaks the wire

**a codec identifier that only matches itself is a wire break on every release.** a service on
`sdk-aws-lambda@0.3.0` calls one on `@0.4.0`; the caller's detector compares against its own literal
and stops to recognize an envelope it understands perfectly.

⇒ so the detector reads the **prefix** and treats the version as data:

```ts
// the tag is `LambdaEndpointError::contemp@$version`
// the DETECTOR matches on the prefix; the VERSION informs how to decode, never whether to
```

⚠️ **this is the `LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP` docblock's own warn, one level up.** it
already states that a producer and a detector which disagree on the literal *"do not fail loudly; the
detector simply stops to recognize the envelope, and a caller fault reads as a success payload."* a
version baked into an equality check makes that disagreement happen **on every version bump, by
construction**.

### #4, priced

`getEnvironment()` is **async** and resolves parsers (git, envars, aws). the error path that writes
this envelope is a middleware catch. so #4 wants either a cached environment or an await on a failure
path — a real design question, where #1–#3 are a literal and a predicate.

⇒ **ship #1–#3; price #4 separately.** the ruling's floor is met by #1.

## the term half, ruled in the same breath

> *"`isLambdaEndpointErrorEnvelopeAncient(res)` … should have a `Contemp` suffix version too"*

✅ **taken, and it is what makes #2 expressible.** the pair splits by dialect, and each says which
question it answers:

```ts
isLambdaEndpointErrorEnvelopeContemp(res)   // the tag — EXACT
isLambdaEndpointErrorEnvelopeAncient(res)   // the flat shape — ambiguous, and explicitly asked for
```

🟡 **symmetry is the point, per `rule.prefer.symmetric-term-pairs`.** an unsuffixed `…Envelope` beside
a suffixed `…EnvelopeAncient` reads as *"the normal one and the special one"*, which is exactly the
frame that let the contemp branch inherit the ancient branch's ambiguity. two suffixed peers state
that these are two dialects, and the caller picks.

⇒ and it retires **branch A** with no runtime argument: a *function choice* is available at runtime
where a type parameter is not. so **F9 stays intact** — the dialect still travels in the type; what
changes is that the caller names the dialect by which function they call.

## as shipped (2026-09-13)

three facts that differ from the illustration above, each a deliberate call:

### the version is a CODEC version, not the package version

the tag is `LambdaEndpointError::contemp@1`, where `1` is a hardcoded codec-version const
(`LAMBDA_ENDPOINT_ERROR_CODEC_VERSION_CONTEMP`), never `package.json`'s `0.3.0`. two reasons:

- **semantic** — a codec version bumps when the wire FORMAT changes, not on every release. a patch
  that touches no envelope shape must not invalidate every deployed decoder's version check.
- **mechanical** — `tsconfig.build.json` sets `rootDir: "src"`, so `src/` cannot import
  `package.json`. the version could not be read from the manifest even if we wanted the release
  number.

⇒ the illustration's `@0.4.0` was the concept; `@1` is the artifact. the directive's floor —
*"version must be included at the least"* — is met by a monotonic codec integer.

### the detector is ONE boundary, not a bare/versioned fork

the first cut wrote `serde === prefix || serde.startsWith(prefix + '@')` — two arms. the wisher
flagged it: *"why a branch? why degrees of freedom accretion?"* it collapses to a single boundary
predicate:

```ts
const CONTEMP_TAG_BOUNDARY = new RegExp(`^${PREFIX}(@|$)`);
// the prefix, then `@version` OR end-of-string. one path.
```

the key reframe: **absence of `@version` IS version 0** — the pre-F22 (v0.3.0) producer, which
`origin/main` confirms emits a bare `_serde: 'LambdaEndpointError::contemp'`. so there is no
bare/versioned fork; the version is always meaningful, 0 when absent. the boundary still excludes a
`…::contempFOO` lookalike (no `@`, not end-of-string).

🟡 **the wire degree of freedom (two on-wire shapes) is finite and carries real weight** — it dies
once every producer passes F22, and until then it is the same incremental-upgrade contract
`invariant.ancient-vs-contemp-callers` already rules. the CODE branch was the avoidable accretion,
and it is gone.

### both clamps are bite-proven

per `rule.require.clamp-edge-cases`:

| clamp | the break | verdict |
|---|---|---|
| cross-version + rollout tolerance | detector → `=== full-tag` (the equality trap) | `[t5]` (`@2`) and `[t6]` (bare) both RED, then green on restore |
| the failhide closure | `asLambdaEndpointErrorEnvelopeContemp` → return unchecked | `[case2]` contemp-assert-on-ancient no longer throws → RED, then green on restore |

## .see also

- `F19` — the row this closes on its contemp half; the ancient half stays as the wire's own ambiguity
- `F20` — the same class on the serialized boundary; branch E already reads an authoritative signal there
- `F9` — dialect-as-a-generic, `✅ ruled`. this ruling keeps it, where branch A would have reversed it
- `invariant.ancient-vs-contemp-callers` — why two dialects exist at all
