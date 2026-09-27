# F16 — the `feat!` commit and the rebase are sequenced AFTER approval, never before it

**rework** = clean · **status** = open · **confidence** = 🔴 **97%**

## the fork, stated fairly

the vision says *"the execution stage owes a `feat!` commit with the conventional-commits break
footer, and naught more."* two ways to read **when**:

| | the sense | what it implies |
|---|---|---|
| **A** | the execution **stone** owes the commit, so it lands before 5.1 passes | a driver commits mid-route, on a tree no guard has accepted |
| ✅ **B** | the execution **stage** owes it, and a stage closes at approval | the commit lands once 5.1 is approved, or the route is finished |

⇒ **B is taken.** and the same fork governs the **rebase onto `origin/main`**, because the rebase
draws the identical quota.

## why B, and it is not a preference

### 1. the route does not ask — measured, not assumed

`rule.forbid.commits-the-route-did-not-ask-for` gives exactly two warrants, and demands the stone be
**named**:

| # | the warrant | this route |
|---|---|---|
| 1 | a stone or guard **names a commit as a deliverable** | ⛔ the `5.1.execution.from_vision` stone names three acts — boot the role, execute the vision, track progress into the yield. **no commit.** (the `.guard` is sealed to a driver, so the stone is the readable half) |
| 2 | the route is **finished** — every stone passed, last approved | ⛔ `route.drive` reports 5.1 still live, and its own stamp reads `passage = blocked` |

⇒ **neither warrant holds**, so a commit here is the rule's own blocker line verbatim: *"a commit no
stone asked for and no approval finished."*

### 2. the lever is not merely absent — it is globally shut

fresh reads, taken at the moment of this entry rather than recalled
(`rule.require.retry-before-you-escalate`):

```
$ rhx git.commit.uses get
   ├─ no quota set
   └─ global: blocked

$ rhx git.branch.rebase begin
   └─ error: no commit quota set
```

⚠️ **the `global: blocked` row is the load-bearing one.** it sits above every org and local row in
the skill's own precedence, so even a granted local quota would not open this.

### 3. 🔴 and the quota is NOT a legitimate escalation — the rule says so, from a measured incident

this is the trap, and a booted rule names it after a driver fell into it on 2026-09-07:

> **`rule.always.raise-a-blocker-a-taken-cannot-close`** — *"this once read 'that quota is a
> legitimate `--as blocked`'. it is not, on its own."* a wisher struck the ask with
> *"you do not need to commit yet. no one approved your stone."*

| the question | who answers it |
|---|---|
| *may I commit?* — the quota | a **human** |
| 🔴 *does this route ASK me to commit?* | the **stone**, and a quota answers it not at all |

⇒ **human-gated does not imply worth a human's grant.** to escalate for the quota asks a human to
pay for an act that stays forbidden once paid for. so this is a **dispute**, never a `--as blocked`.

## what the two unapplied `origin/main` gates have to do with it

they are the **same fork, one step out**. both gate files live on `origin/main` and not in this
worktree — verified, with a positive control:

```
$ rhx globsafe --pattern 'src/*.test.ts'   ->  0     ⚠️ an absence
$ rhx globsafe --pattern 'src/*.ts'        ->  1     ✅ the control: globsafe reads src/ fine
$ git ls-tree origin/main --name-only src/ ->  src/index.test.ts
                                               src/advertisedExamples.test.ts
                                               src/advertisedExamples.coverage.integration.test.ts
                                               src/publicSurfaceShapes.test.ts
```

⇒ the only act that brings them into reach is the **rebase**, and the rebase is the quota above.

### 🔴 the class is FOUR files, and the swept result CONFIRMS the named two

a review named two gates. `rule.require.sweep-the-defect-class` asks what else the stated cause is
true of — the cause is *"a main-only test that reads this route's renamed surface"*, so the family is
every main-only test file, which is **four**:

| main-only file | reads a surface this route renames? | at risk |
|---|---|---|
| `src/index.test.ts` `[t4]` | ✅ an **exhaustive** export list, and this route renames exports | 🔴 **yes — WILL GO RED** |
| `src/advertisedExamples.coverage.integration.test.ts` `[case2][t0]` | ✅ regex-reads `readme.md` for advertised symbols, and this route rewrote that section | ⚠️ **yes — UNKNOWN** |
| `src/advertisedExamples.test.ts` | ⛔ runs `@example` docblocks. **measured: this tree carries ZERO** — 7 `@example` hits, all `@example.com` emails | ✅ no |
| `src/publicSurfaceShapes.test.ts` | ⛔ imports `asLambdaEvent` / `runLambdaEndpoint` / `asLambdaEndpointOutput` — the **ask/invoke** family, which **F06** scopes out | ✅ no |

⇒ **the sweep narrows rather than widens**, and that is worth a record: a sweep whose answer is
*"the named set was already the whole class"* is a result, not a null one.

## the rework, and why it is clean

| | |
|---|---|
| **clean** | the deferred acts are a commit and a rebase. to reverse the call is to **run them**, in the order the route already prescribes. no code hardens against it and no later work builds upon it |
| **what it does NOT defer** | ⛔ the repair itself. `src/index.test.ts` `[t4]`'s fix is a **one-key edit** and it is written down, with its status first (`rule.require.deferred-defect-records-lead-with-status`) |

## the confidence, and why it is not 100

**97%.** the 3% is one sense I cannot close from inside the route: **if a wisher intends *"execution
stage"* to mean *"the 5.1 stone"*, sense A holds and the commit is owed now.** I cannot settle that
— and I also cannot ACT on it, since the quota is globally shut either way. ⇒ so the residual moves
the justification and not the outcome, which is why it does not earn a halt.

## where it is cited

- `5.1.execution.from_vision.yield.md` — the deferral record, status-first
- `.reviews/peer/…r008._.taken.by_self.behavior-intent-coverage.md` — both blockers reduce here
- `.reviews/peer/…r009._.taken.by_self.ergo-friction-hazards.md`

## the verdict, once ruled

⏳ **unruled.** the wisher settles it by the act that closes the route: an approval of 5.1 makes
sense B true by construction, and a granted quota with an instruction to commit now makes it A.
