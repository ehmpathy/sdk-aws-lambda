# F03 — ⛔ DISSOLVED — `request` collides with middy's internal bag word

**rework** clean · **status** 🌙 **dissolved** · **confidence** n/a *(was: open, 85%)*

> 🌙 **this fulcrum no longer exists.** it weighed a cost of the `request` field name, and **F01
> struck that name** — the envelope is `event`. there is no collision left to weigh.
>
> ⚠️ kept, not deleted. a fulcrum that **vanishes** when a premise is corrected is evidence the
> defect sat at the **shape** grain, never the detail grain. this drive raised F03 across three
> rounds, refined it each time, and never once asked whether the field needed that name at all
> (`rule.require.review-attempts-deletion` — *"could this be zero exports instead of one?"*).
>
> ⇒ one fact below outlives the entry: **middy's `request` bag is real and internal-only**, and an
> sdk contributor who edits middleware still meets it. that is now recorded durably in
> `.agent/repo=.this/role=any/briefs/domain.terms/event.md`, where a fulcrum cannot rot.

---

## the original entry, as it stood

## the fork, stated fairly

middy names its own middleware bag `request` — `request.event`, `request.response`
(`genZodBodyValidationMiddleware.ts:32-33`, and every middleware in `src/…/middleware/`).

so `request` would carry **two senses** in one codebase:

| where | `request` means |
|---|---|
| inside a middleware | middy's bag: `{ event, response, context, … }` |
| inside `invoke` | the reconciled http request |

| option | |
|---|---|
| **A** accept the collision, scope it by surface | **taken** |
| **B** pick a word middy does not use (`httpRequest`, `inbound`) | avoids it, at the cost of a longer or invented name |
| **C** rename middy's local variable repo-wide to `bag` | removes the collision at its source |

## taken, and why at the time

**A.**

the two senses **never meet on one surface**:

- middy's `request` appears only inside middleware bodies. no consumer of this package writes one
- `invoke`'s `request` appears only on the consumer surface. no middleware body destructures it

⇒ a reader is never in a position where both senses are live, which is the test
`rule.forbid.ambiguous-labels` actually asks: *can a human read this label exactly one way,
**without context**?* here context is the file, and the file always settles it.

**B** costs a worse name for a collision that cannot fire. `httpRequest` mashes trigger × shape
(`rule.forbid.names-that-mash-dimensions`); `inbound` is an invented term.

**C** is real and tempting — middy's own docs call it `request`, so a rename to `bag` would make
our middleware read *less* like the vendor's. out of scope, and it would touch every middleware.

## rework, and why clean

if a reviewer rules the collision unacceptable, it is one field name. the internals are untouched
either way.

## confidence, and why it is not higher

**85%.** the 15% is `rule.require.ubiqlang` read strictly: *one concept per term*, full stop, with
no surface-scoping carve-out. a reviewer who reads it that way has a fair case, and the counter I
offer (the two senses never co-occur) is an argument rather than a measurement.

⚠️ I have flagged this **myself**, unprompted, because a name collision I introduce is exactly the
kind of item a self-review talks itself past.

## where

- `1.vision.yield.md` → *the one cost of `request`, stated*
- `1.vision.experience.case=2.reach-the-envelope-honestly.md` → the sharp edge nearby

## the verdict, once ruled

_open — awaits the fulcrum council._
