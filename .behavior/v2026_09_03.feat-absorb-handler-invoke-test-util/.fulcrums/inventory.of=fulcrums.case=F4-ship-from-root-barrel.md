# F4 — it ships from the root barrel, not a subpath

## the fork, stated fairly

the util must reach consumers. two shapes:

- **root barrel** — `import { askLambdaEndpointForTest } from 'sdk-aws-lambda'`
- **subpath** — `import { askLambdaEndpointForTest } from 'sdk-aws-lambda/test'`

today `package.json:20` declares only `"main": "dist/index.js"`. there is **no `exports` map**, so
a subpath reaches its file by filesystem path or not at all — it would need an `exports` field
added, which also (by node semantics) makes every other deep path unreachable at once.

a third shape is ruled out by fact, not taste: **leave it in `__test_assets__`**.
`tsconfig.build.json:16` excludes `**/__test*__/**/*`, and `package.json:27-29` ships only `/dist`,
so a file there cannot reach a consumer. that is the whole reason this wish exists.

⚠️ **a fourth shape was omitted from this fork, and it has the strongest precedent — added at r3.**

- **a separate peer package** — e.g. `sdk-aws-lambda-test`, imported only by test files.

this is the **incumbent pattern in this very ecosystem**: `simple-lambda-handlers` and
`simple-lambda-testing-methods` are exactly that split, and it is what all 20 repos run today. it
would also fully dissolve the awkwardness this fulcrum concedes below — a test util reachable from
the production barrel, with a name convention as its only guard.

🔴 **it is excluded, but by a different kind of exclusion than the third shape, and the difference
must be visible.** `__test_assets__` is ruled out by a **build fact** anyone can check. the peer
package is ruled out by the **wisher's decree**: *"one package should own both the handler factory
and the way you exercise it in-process."*

⇒ a fork that presents itself as complete owes the reader which exclusions are **derived** and which
are **given**. this one had blurred them, and a reader without the wish's sentence to hand could not
tell why the incumbent arrangement was never weighed.

## taken, and why at the time

**taken: root barrel.**

1. **a subpath forces an `exports` map, and the map is the risky change — not the util.** to add
   a `"./test"` entry you must also add `"."`, and the moment `exports` exists node stops serving
   every unlisted deep path. any consumer who reaches into `sdk-aws-lambda/dist/...` today breaks.
   that is a package-wide blast radius bolted onto a small feature.
2. **the util carries no weight worth a firewall.** the usual case for a test-only subpath is to
   keep test-only dependencies out of the production graph. it does not apply here: the pass-through
   needs `aws-lambda` types (already a dep) and *no jest*. the two assets that do need jest —
   `createTestContext.ts:27` (`createMockLog`) and `createInProcessLambdaHarness.ts:112` — are
   deliberately **not** in scope, precisely because `jest` is devDependency-only
   (`package.json:80-115`) and a runtime import of it would break a consumer install.
3. **it matches how the sdk already publishes.** `index.ts` is a flat barrel of 40+ symbols. one
   more fits the extant shape; a subpath opens a second front door for one function.

## rework, and why clean

**clean, and additive in both directions.** root → also-subpath is a pure addition (keep the barrel
export, add the map). subpath → also-root is likewise. neither breaks a consumer already on the
other. the only genuinely dirty move is *removal* of a shipped entry point, which neither direction
requires.

## 🔴 the correction — reason #2 is now FALSE, found at self-review r5

**this entry was written when the wish scoped `onReferenced` alone.** the wisher's A2 amendment on
2026-09-08 added `onSerialized`, which needs a `serverless.yml` lookup at `at: 'local'`, which needs
a yaml parser. so:

```
package.json  +  "yaml": "2.9.0"        ← in DEPENDENCIES, not devDependencies
```

reachable from the barrel by a static import — `src/index.ts` → `runLambdaEndpoint` →
`onSerialized.ts:6` → `local/getOneHandlerFromServerlessYml.ts:2` → `yaml`. **so every consumer of
this package installs it**, even a production lambda that only ever calls `genLambdaEndpoint`.

⇒ **that is precisely the case reason #2 declared inapplicable:**

> *"the usual case for a test-only subpath is to keep test-only dependencies out of the production
> graph. **it does not apply here**"*

it applies here now. a test-only code path pulled a runtime dependency into the production graph,
which is the exact hazard a subpath firewall exists to prevent.

⚠️ **and the `where` section below was false too** — it read *"`package.json` — untouched under this
choice; that is the point"*. the file is touched, by this choice, in the way the choice claimed it
would not be.

### the measured cost, so the council decides on facts

| | |
|---|---|
| `yaml@2.9.0` unpacked | **670 KB** (685,953 bytes) |
| transitive dependencies | **zero** — no supply-chain fan-out |
| who pays | every consumer install, whether or not they ever run a test |
| what it buys | one function: the `at: 'local'` handler lookup |

⇒ **it is a real cost and a bounded one.** zero transitive deps is the material mitigation — this is
install weight, never a supply-chain surface.

### the options, NOT chosen here

`rule.always.defer-fulcrums-to-last` and `rule.always.fix-forward-under-scouts-honor` both point the
same way: the SAFE/CLEAN test fails (a dependency reclassification changes consumer installs and
ripples into how the package is published, the import site, and this very verdict), so it defers —
and F4 is already the open row that owns it.

| option | what it costs |
|---|---|
| leave it | 670 KB on every install, and reason #2 stays false |
| `optionalDependencies` + a lazy `await import('yaml')` | the dep becomes opt-in; needs an error that names the fix when absent |
| the subpath + `exports` map | the original alternative — and now it has a concrete argument behind it, where before it was only a *semantic* preference |

🔴 **note what changed for the council:** the 15% below said a maintainer *"may want the subpath
anyway as a **semantic** firewall"*. that is no longer the strongest case for a subpath. there is now
a **material** one.

### 🔴 the lazy-import option is REFUTED — i004 r011, and the table above oversold it

both peer lanes of i004 reached this fulcrum independently (r010 item 5, r011 item 2), which is one
cost seen twice rather than one lane's opinion. r011 then priced the middle row and found it does
not buy what it appears to:

> *"a **lazy `require`/`await import('yaml')` inside `getOneHandlerFromServerlessYml` alone does not
> fix this for bundled lambda deploys** — esbuild bundles any statically-reachable `require()`
> regardless of whether the enclosing function is ever called, so it only helps unbundled Node
> consumption (deferred parse/eval), not deploy-artifact size."*

**its premise is checkable, and it checks out:**

| r011's claim | verified |
|---|---|
| the build output is CJS | ✅ `tsconfig.json:19` — `"module": "commonjs"`; no `"type": "module"` |
| no `sideEffects` field to license tree-shake | ✅ absent from `package.json` |
| no `exports` map | ✅ `package.json:20` declares `"main"` alone |

⇒ so a lazy import defers parse and eval, and removes **zero bytes** for the consumer who actually
pays — a bundled lambda, where cold-start size is the reason anyone cares.

🔴 **and it refutes a claim the vision yield makes in its own `cons` section:** *"it publishes a
test util from the production barrel (F4). **tree-shakeable** and jest-free…"*. **a CJS `require()`
graph is opaque to esbuild/webpack DCE**, so the util is not tree-shakeable as shipped. that word was
asserted rather than measured, and it understated this fulcrum's cost for the whole drive.

### the options, re-priced after r011

| option | what it costs | verdict |
|---|---|---|
| leave it | 670 KB on every install, and reason #2 stays false | live |
| `optionalDependencies` + a lazy `await import('yaml')` | defers parse only; **buys zero bytes for a bundled lambda deploy** | 🔴 **refuted for the case that motivates it** |
| the subpath + `exports` map | the package-wide blast radius above | live — and now the only option that reaches the stated goal |

⇒ **r011's bottom line, which this entry adopts:** *"If bundle size is the concern (and for lambda
cold starts it should be), the real fix is the subpath/`exports` split, accepting the blast-radius
cost F4 already names."*

🟡 **so the council's fork narrows from three to two**, and the choice is now plainly between the
670 KB and the `exports`-map blast radius. that is a sharper question than this entry posed before,
and it is the reviewer's contribution rather than mine.

### 🔴 the re-price above was OVER-CORRECTED — r011 reversed its own verdict at i006

the same lane, two rounds later, says the refutation was applied too broadly:

> *"that argument was applied to rule out laziness altogether, and **it shouldn't have been**:
> `getOneHandlerFromServerlessYml` (and by extension `yaml`) is only exercised by
> `onSerialized({ at: 'local' })`, which is a **test-time-only path** — no production bundled lambda
> should ever call it. For the majority of consumers (anyone who `npm install`s and runs in Node
> without bundling this sdk itself — i.e. every test runner), converting the top-level
> `import { parse } from 'yaml'` to `const { parse } = await import('yaml')` inside the function body
> removes `yaml` from the *static* module graph at zero package.json/`exports` risk."*

⚠️ **the reviewer is right about the logic, and the correction needs one more turn to be usable.**
the two rounds price two DIFFERENT costs, and neither round said which:

| cost | who pays it | does the lazy import help? |
|---|---|---|
| **install size** — 670 KB in `node_modules` | every consumer | ❌ **no.** `yaml` stays in `dependencies` |
| **bundle size** — bytes in a deployed lambda | consumers who bundle | ❌ **no** — esbuild pulls a statically-reachable `require` regardless (i005 r011's own point) |
| **load time** — parse + eval at import | consumers who do NOT bundle | ✅ **yes**, and only this one |

⇒ **so it is a real mitigation of a cost this entry never priced.** this fulcrum's stated harm is
*"670 KB on every install"*, and the lazy import moves that number by zero. it moves a third number,
which is genuine and smaller.

🟡 **not taken by the driver, and the reason is scope rather than merit.** it is a behavior change on
a shipped path (a sync import becomes an async one) argued for a cost this fulcrum does not track,
raised by a lane that had argued the opposite two rounds earlier. ⇒ that is a **judgment about which
cost matters**, which is exactly what a fulcrum defers (`rule.always.defer-fulcrums-to-last`).

### the options, re-priced a second time

| option | moves install size | moves bundle size | moves load time |
|---|---|---|---|
| leave it | — | — | — |
| lazy `await import('yaml')` | ❌ | ❌ | ✅ |
| the subpath + `exports` map | ✅ | ✅ | ✅ |

⇒ **the fork is back to three**, and the middle row is now honestly priced rather than either
oversold (as it was before i004) or refuted outright (as it was after).

## confidence, and why 85% → **70%**

⚠️ **downgraded at self-review r5.** the `exports`-map hazard is still a checkable node fact and the
jest argument still holds. what fell is reason #2, which was one of the three legs the choice stood
on — and it fell because the wish's scope grew after this entry was written.

⇒ **a fulcrum's confidence is a claim about the world at the moment it was written.** when the scope
moves, the fulcrums must be re-derived against it; this one was not, and it advertised a false cost
to the council for the whole of the execution stage.

## where

- `src/index.ts` export block
- `package.json` — 🔴 **`yaml: 2.9.0` added.** this line read *"untouched under this choice; that is
  the point"* until r5, which is exactly backwards
- `src/domain.operations/runLambdaEndpoint/local/getOneHandlerFromServerlessYml.ts:2` — ~~the import
  that carries the dependency into the shipped graph~~ → 🔴 **now a lazy `await import('yaml')` in
  the function body**

## 🔴 RULED IN PART by the wisher, 2026-09-10 — the **load-time** half is taken

> *"load time yes; │ lazy await import('yaml') │ moves load time only. install size and bundle size
> both move by zero │"*

the wisher took the middle row of the option table above, and quoted its own price back as the
reason — **a mitigation that moves one of three costs is worth its price when the price is one
line.**

### what shipped

```ts
// getOneHandlerFromServerlessYml.ts — inside the function, on the local-locus path
const { parse: parseYaml } = await import('yaml');
```

**the function was already `async`**, so the change is one import line relocated. no signature moved,
no caller changed, no test changed. that is the whole rework, and this entry priced it as *"a
behavior change on a shipped path (a sync import becomes an async one)"* — a description that reads
as a contract change and describes a relocation.

⇒ runtime proof: `--scope path://runLambdaEndpoint` → **37 passed / 4 suites**, with
`getOneHandlerFromServerlessYml.integration.test.ts` among them. the lazy resolve works.

### 🔴 what is NOT closed, and this entry must not read as though it were

| cost | who pays | moved? |
|---|---|---|
| **load time** | consumers who do NOT bundle — every test runner | ✅ **taken** |
| **install size** — 670 KB | every consumer | ❌ `yaml` stays in `dependencies` |
| **bundle size** | consumers who bundle | ❌ esbuild follows a reachable `require` |

⇒ the 670 KB still needs the **`exports`-map subpath split**, and that is a package-wide resolution
change whose blast radius reaches every consumer's import path. **that half remains a maintainer
call.**

🟡 **and the split is why this row stayed a fulcrum rather than a defect.** the two halves have
opposite rework grades — one line vs a resolution change — and this entry had bundled them into a
single leave/split fork. **a fulcrum that fuses two costs of different price forces a council to rule
on the expensive one to reach the cheap one.**

### 🟡 a THIRD option for the council — cheaper than the split, and it buys only one of the two halves

raised at i037 r011 `enroll-impl-arch-defects`, which verified the three facts it turns on:

| the fact | verified |
|---|---|
| `package.json` has no `exports` field | ✅ |
| `yaml` / `zod` / `@aws-sdk/client-lambda` are all plain `dependencies` | ✅ |
| `tsconfig.build.json` compiles **per-file**, with no bundle step | ✅ — so `dist/` is already a 1:1 mirror of `src/` |

⇒ **the third fact is what makes this cheap.** a subpath entry needs a file to point at, and every
file already exists at a predictable path. so an `exports` map with subpath entries
(`sdk-aws-lambda/runLambdaEndpoint`, `sdk-aws-lambda/asLambdaEvent`) is near-free to add **today**,
ahead of any package restructure.

🔴 **and it buys exactly ONE of the two open halves — state that plainly, or the council over-values it:**

| cost | does the subpath map move it? |
|---|---|
| **install size** — 670 KB in `node_modules` | ❌ **no.** `yaml` is still a `dependency`, still installed |
| **bundle size** — `yaml` in a bundler's graph | ✅ **yes**, for a consumer who imports the subpath rather than the barrel |

⚠️ **it does not retire the blast radius, it defers it.** the moment `exports` exists node stops to
serve deep paths it once served, which is the package-wide risk this entry has priced twice. what is
new is that the map can ship with **only additive** entries and no file moves — so the risk is the
resolution change alone, unbundled from a restructure.

| option | install size | bundle size | blast radius |
|---|---|---|---|
| leave it | ❌ | ❌ | none |
| the lazy import, **shipped** | ❌ | ❌ | none — load time only |
| **the `exports` map, subpaths only** | ❌ | ✅ | the resolution change |
| the full subpath split | ✅ | ✅ | the resolution change + a restructure |

## the verdict

_🔴 **ruled in part.** the load-time mitigation is taken and shipped 2026-09-10. the install-size and
bundle-size halves stay open — and they now have **different** remedies: bundle size alone is
reachable by an additive `exports` map, where install size still needs the full split._
