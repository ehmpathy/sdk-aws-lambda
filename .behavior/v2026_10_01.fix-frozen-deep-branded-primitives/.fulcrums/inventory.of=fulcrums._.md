# inventory.of=fulcrums

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F1 | both steps ship on one branch, as ONE commit, in one 0.7.1 release | clean | **ruled — wisher: "both should ship together / all ships as a patch"** | 100% |
| F2 | the clamp imports the real `IsoTimeStamp` via a pinned `iso-time` devDep | clean | **ruled — wisher: keep the devDep** | 100% |
| F3 | the runtime walk moves to type-fns' `asFrozenDeep`, beside the type | clean | **ruled — wisher: "switch fully at runtime too … now"; best-guess A reversed to B** | 100% |
| F4 | step 2's stricter `Map` / `Set` type ships in a patch | clean | **ruled — wisher: "this is fine for a patch"** | 100% |
| F5 | perBatch's catch-all record catch is deferred, not narrowed in this patch | clean | **ruled — wisher: "defer is fine"** | 100% |
| F6 | perBatch's inline id pipelines are deferred to their own refactor | clean | **ruled — wisher: ok** | 100% |
| F7 | `forAsk`'s `TInput` / `TOutput` positional rename is deferred to a family-wide sweep | clean | **ruled — wisher: ok** | 100% |
