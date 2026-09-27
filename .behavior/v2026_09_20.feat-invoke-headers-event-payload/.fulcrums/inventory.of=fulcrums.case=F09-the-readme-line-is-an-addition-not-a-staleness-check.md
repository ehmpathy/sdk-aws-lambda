# F09 — the readme acceptance line is read as an ADDITION, not a staleness check

**rework** clean · **status** open · **confidence** **84%**

## the fork, stated fairly

the wish's acceptance list holds *"readme + public docs reflect it"*. that sentence has two senses,
and the measurement is what makes them differ:

| measured | |
|---|---|
| `rawEvent` in `readme.md` | **0 hits** |
| `invoke` in `readme.md` | 5 lines — `:21`, `:75`, `:115` |
| of those, `forApiGateway`'s | ⚠️ **exactly one** (`:115`). `:21` sits under `import { genLambdaEndpoint }` (`:16`), so it is the **twin's** |
| readme examples that reach the envelope | **0** — every one destructures `{ event }` alone |

⛔ ~~⇒ **no readme line goes stale on this change.**~~ 🔴 **STRUCK at execution — ONE does**, and it
is the last row above read to the wrong conclusion.

> *"every one destructures `{ event }` alone"* — true, and in the `forApiGateway` example that
> `event` **is the body**. under the ruled shape the same word denotes the envelope, so the example
> goes stale by the very rename this fulcrum is about.

| example | family | stale? |
|---|---|---|
| `:21`, `:75` | the twin | ✅ no — `event` is unchanged there (F06) |
| 🔴 `:115` | `forApiGateway` | ⛔ **yes.** shipped as `invoke: async () => ({ status: 204 })` |

⚠️ **the option table below still stands, and B is now doubly wrong**: it was already the weaker
read, and it is no longer even sufficient — a zero-edit readme would publish a stale destructure.

| option | what the line demands |
|---|---|
| **A — an addition** ✅ taken | the envelope and `headers` are **undocumented today**. the line is met by documentation of the new shape, which the readme has never carried |
| **B — a staleness check** | the line asks only that naught be left wrong. ⛔ ~~measured, naught is ⇒ met by zero edits~~ 🔴 **one line IS wrong**, so B demands an edit too — it is a strictly smaller A, never a no-op |

## taken, and why — at the time

**A**, on a measurement rather than a preference.

the envelope is **reachable and undocumented**. a consumer today learns it exists from the type, or
from another repo's migration guide — never from this package's own readme. so `headers` is not
merely one hop shorter than `rawEvent.headers`; it is the difference between a **documented**
affordance and an undocumented one (`rule.require.discoverability`).

⇒ to take **B** would ship a rename whose whole justification is ergonomic, into a doc that never
mentions the field either way. the change would be invisible on the one surface a consumer actually
reads.

## rework, and why

**clean.** option A adds readme prose. to fall back to **B** is a deletion of that prose — no code
depends on it, no test asserts it, no consumer is hardened against it.

## confidence, and why it is 84%

the **measurement** is solid: the numbers above are counted, and the one-example result was a
surprise worth the check.

what holds it at 84% is that **A expands scope beyond the literal sentence.** the wish says
*"reflect"*, which is a weaker verb than *"document"*. a wisher who meant B would be right to say the
drive helped itself to extra work — modest work, and work the drive was not asked for.

⚠️ and the self-criticism that keeps it honest: **A is the sense that makes my own ergonomics
argument stronger**, so i had a motive to prefer it. i believe the measurement stands on its own, and
i record the motive rather than trust my own neutrality (`rule.require.trust-but-verify`).

## ⚠️ the trap this fulcrum exists to disarm

an execution stage that reads the acceptance line and greps the readme for `rawEvent` finds **zero**
and may conclude the line is **already met**.

⇒ it is not. the line is met by **new** prose. that trap is the concrete reason this is itemized
rather than left as a note — a silent scope call is exactly what a fulcrum list exists to surface
(`rule.always.itemize-the-fulcrums-you-best-guess`).

🔴 **and the trap has a second mouth this entry did not see.** a grep for `rawEvent` returns zero
because the stale line does not contain `rawEvent` — it contains **`event`**, under its old sense.
⇒ **the word that goes stale is the one that STAYS**, which is precisely the migration hazard the
vision names for consumer code (*"`event` keeps its word and changes its type"*). the readme was
subject to it too, and this fulcrum reasoned about the readme as though it were not.

## where

- `1.vision.yield.md` → *evaluation → the readme finding*
- `readme.md:115` — the one `forApiGateway` example, which the new shape must reach

## the verdict, once ruled

_open — awaits the fulcrum council._
