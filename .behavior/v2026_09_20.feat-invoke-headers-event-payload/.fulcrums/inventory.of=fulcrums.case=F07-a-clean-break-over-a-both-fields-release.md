# F07 — a clean break, over a both-fields release

**rework** clean · **status** 🔴 **RULED — the wisher confirmed a hard cutover** · **confidence** n/a (settled)

the wish's **open question 4**, answered in the drive and then **ruled by the wisher**.

> **the ruling, verbatim** — *"yeah we want a hard cutover … that's on purpose"*

⇒ the fulcrum is closed. what follows is kept because **the reasoning that reached A was partly
wrong**, and a right answer reached by a wrong route is the kind a later reader inherits and reuses.

## the fork, stated fairly

| option | |
|---|---|
| **A** clean break — `rawEvent` is gone in one major | **taken** |
| **B** a release that carries both `rawEvent` and its replacement, with a deprecation note | |

## taken, and why at the time

**A**, on a measurement rather than a preference.

### ⛔ ~~there is no installed base to protect~~ — **FALSE. struck in self-review 4/5**

~~`git.repo.get files --repos 'ehmpathy/*' --words 'forApiGateway'` → 55 files, 2 repos, every hit a
behavior journal or this repo's own `src/`. **zero production handlers** consume it.~~

🔴 **the installed base is 78 production handler files.**

```
git.repo.get files --in ahbode/svc-gateway --words 'rawEvent' --paths 'src/**'
  ->  78 files, all under src/contract/handlers/
```

and they read it in exactly the shape this route repairs:

> `ahbode/svc-gateway/src/contract/handlers/rest/mutation/sendQuote.ts:75-76`
> ```ts
> invoke: async ({ event, rawEvent }) =>
>   (await handle({ headers: rawEvent.headers, body: event })).body,
> ```

⚠️ **the defect in my search was the SCOPE, never the method.** i ran `--repos 'ehmpathy/*'` and read
its zero as *"org-wide"*. `ahbode/*` is a second, larger org — ~25 `svc-*` repos — and `svc-gateway`
even carries a brief titled `rule.require.lambda-handlers-use-genlambdaendpoint.md`.

⇒ the positive control i ran was **sound and irrelevant**: it proved the tool could read
`ehmpathy/*`, which was never the question. **a control proves your instrument works; it says not one
word about whether you pointed it at the right place**
(`rule.require.positive-control-before-absence-claims`, at a scope grain rather than a query grain).

### the ruling, and why A survives its own broken premise

the wisher ruled **A** with the base measured at 78 rather than 0. so the decision never rested on
the false claim — but *my argument for it* did, and these two did not:

| the surviving argument | still holds? |
|---|---|
| **B** forks the contract for no measured beneficiary | ✅ — and now *stronger*: 78 sites would each have two valid spellings, so the fork is 78 sites wide |
| **B** makes the consumer experience worse (`case=3`) | ✅ — and now *much* stronger. 78 files that compile under B are 78 files that silently keep the stale name until a later release where nobody holds the context |

⇒ and one argument the measurement **adds**, which i could not have made before:

🔴 **the migration is mechanical and each site gets SHORTER.**
`{ event, rawEvent }` → `{ event, headers }`, and `rawEvent.headers` → `headers`. that is a
`sedreplace` pass, compiler-guided, with a red build if it is incomplete. 78 files of *that* is a
different cost from 78 files of judgment.

### **B** would fork the contract for no measured beneficiary

two live names is two code paths on a public surface, and every future guarantee — a doc line, a
type narrow, a deprecation lint — must land in both (`rule.forbid.parallel-codepaths`,
`rule.require.widen-before-parallel`).

### and **B** makes the consumer experience *worse*, not better

`case=3` is the argument: under **A** a stale `rawEvent` is a **compile error that names the fix**.
under **B** it compiles, the deprecation note goes unread, and the break merely moves to a later
release where nobody holds the context.

⇒ **B** spends a real cost to postpone a surprise that **A** resolves loudly and immediately.

## rework, and why clean

**B** remains available at any later date — a deprecated alias is purely additive. so **A**
forecloses no option; it only declines to pay up front.

## confidence

~~**92%.** the 8% is the one consumer the search cannot see: a repo outside the `ehmpathy/*` scope…~~

🔴 **settled — the wisher ruled it.** and the struck sentence is worth a second look: it named the
exact failure mode (*"a repo outside the `ehmpathy/*` scope"*) and priced it at 8%. the real answer
was 78 files.

⇒ **a residual i can name is not a residual — it is a search i declined to run.** to price an
identified gap and move on is the tell; the gap had a name, and naming it cost less than the check
would have.

## ⚠️ what the ruling obligates

- a `feat!` / `BREAKING CHANGE` footer → **`0.5.0`**, not a hand-set major (`package.json:5` = `0.4.2`)
- `readme.md:115` updated to the new shape — **F09** reads that line as an addition
- the downstream migration guide that still names `rawEvent` — caught as a dream, another repo:
  `dreams/v2026_09_20.reseed.declapract-migration-guide-names-rawEvent.md`
- 🔴 **a migration note for `ahbode/svc-gateway`'s 78 handlers.** it was not owed while the base read
  zero; it is owed now. the content is one `sedreplace` pair plus a compile check:
  ```
  { event, rawEvent }  ->  { event, headers }
  rawEvent.headers     ->  headers
  ```
  ⇒ **out of scope to apply** — it lands in another repo — but in scope to **state**, so the
  cutover is not a surprise to the team that owns those files

## where

- `1.vision.yield.md` → *open questions → 4*, *groundwork → who consumes it, org-wide*
- `1.vision.experience.case=3.a-stale-rawEvent-fails-at-compile.md`

## the verdict, once ruled

🔴 **RULED — a hard cutover, on purpose.** the wisher, 2026-09-20:

> *"yeah we want a hard cutover … that's on purpose"*

⇒ ruled **with the 78-file base on the table**, so the ruling is not a ratification of my broken
premise. option **B** is closed.
