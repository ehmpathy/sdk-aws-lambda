# rule.require.reread-the-subject-a-repeated-find-names

## .what

when the same item is raised across rounds and your answer each time is an **argument** rather than
a **change**, treat the argument as the suspect. go re-read the subject it defends.

an argument that survives three review rounds has been selected for **durability**, never for
**truth** — each round you refine the sentence, and each refinement makes the position harder to
dislodge while the code underneath it stays exactly as wrong as it was.

```ts
// the position, held across four rounds:
//   ".why no allowlist = an allowlist states which errors this catch is ENTITLED to absorb,
//    and the answer is NONE. an escaped handler may throw any value at all, so the rule's
//    demand is met because all of them reach the output, never because a few were named"
//
// true of the block as written — and the block was the defect. the `try` spanned FOUR steps
// and only ONE was the subject under test, so "the errors this catch absorbs" was two
// populations under one name. an allowlist was available the whole time.
```

## .why

a refuted find is the one class of feedback with **no natural correction pressure**. every other
kind either lands (the code changes) or lapses (the reviewer drops it). a refutation you author
persists in your own artifacts, gets cited by your next round's articulation, and grows more
credible each time it is retold — so the position accumulates the *appearance* of scrutiny while it
receives none.

three costs, and they compound:

- **the argument is re-read; the subject is not.** each round you open your own prior `.taken`,
  polish the case, and ship. the file the reviewer pointed at goes unopened, because you already
  "know" what it says.
- **an improvement to the prose reads as an improvement to the code.** on the case that produced
  this rule, one round added a `console.error` and rewrote the doc — which made the defense
  genuinely better and the contract byte-identical. a reviewer who reads a better argument sees
  progress (see `rule.require.deferred-defect-records-lead-with-status` for the same illusion at a
  different grain).
- **convergent repetition reads as reviewer noise rather than as signal.** when three reviewers
  raise one item in a single round, the natural read is *"they share a rubric"*. the sharper read is
  *"three independent passes found this, so it is the most visible item in the diff."*

measured on the case that produced this rule: the same catch block was raised by **three reviewers
in one round**, after prior rounds had raised it too. the refutation was well-argued and internally
consistent. it collapsed in under a minute once one reviewer supplied a **concrete example** — and
the flaw it exposed (a conflated subject) was the same flaw as two other defects on that branch.

## .the test — for the proposer

when you sit down to answer a find you have answered before, ask: **"what did I change last time?"**

| answer | verdict |
|---|---|
| the code | fine — the find is a repeat because the fix was partial |
| the argument, or the documentation of the argument | **stop. re-read the subject before you write one more sentence** |
| no code at all; I cited my prior `.taken` | **stop.** you have not reviewed this find, you have filed it |

then run the two moves that break an argument open:

1. **ask for, or invent, a concrete example.** an abstract defense ("any value could be thrown")
   survives abstraction and dies on a case ("a `TypeError` from a misconfigured handler reference").
   if the reviewer supplied one, that example is the whole find — answer it, never the general
   claim around it.
2. **re-read the subject with the question "is this ONE subject?"** most durable-but-wrong arguments
   rest on a **conflated subject** — a name that covers two populations, so a statement true of one
   reads as true of both. count the steps, the callers, the axes, the phases.

## .the test — for the reviewer

when you meet an articulation that **refutes** a find, check two facts about it:

- **has this find been refuted before?** grep the prior `.taken` files for the same subject. a
  second refutation of one find is worth more scrutiny than a first, not less.
- **does the refutation answer a concrete case, or a general claim?** a defense pitched entirely at
  the general level ("no allowlist is possible", "every caller needs this", "the type cannot express
  it") has usually never been tested against one instance.

the tells:

- an articulation that quotes **its own prior round** as support
- a refutation that got **longer** each round while the diff for that file stayed empty
- a `.why not X` doc block whose case is sound and whose scope is unstated — *sound about what?*
- the same find from **multiple reviewers in one round**, met with one refutation that treats them
  as a single objection

and the strongest move available to you as a reviewer: **supply a concrete case.** a general find
invites a general refutation; a named scenario ("a `TypeError` from a misconfigured handler
reference") cannot be answered in the abstract. it is also the cheapest item you can add.

## .the caveat

- **this is not "always concede".** a refutation can be right, and a correct refutation repeated is
  no defect — `rule.always.converge-with-reviewers` explicitly sanctions "hold your ground,
  articulate WHY it holds with concrete evidence". the rule fires on the **pattern of your own
  behavior**: the argument improved and the subject went unread.
- **a genuinely wrong reviewer will repeat.** a rubric misfire recurs every round by construction.
  the distinction: for a misfire you can name the **specific false premise** in the find; for a
  durable-but-wrong defense you can only restate why your position is reasonable.
- **cite the round that attacked it.** once you have genuinely re-read the subject and the position
  holds, say so with the evidence and move on — this rule asks for a re-read, and
  `rule.require.review-attempts-deletion` asks that a claim be attacked **once**, on the record,
  never every round.

## .examples

### 👎 bad — the argument improves, the contract does not

```
round n-2: ".why no allowlist = an escaped handler may throw any value at all"
round n-1: same claim, better prose, + a console.error added
round n:   same claim, cited from my own round n-1 .taken
```

three rounds of authorship, zero rounds of re-read of the four-step `try` the claim was about.

### 👍 good — the subject re-read, and the populations counted

```ts
// the try spans FOUR steps; only ONE is the subject under test:
//   1. await text(req)                      -> the harness   -> a harness defect
//   2. asApiGatewayProxyEvent({ … })        -> the harness   -> a harness defect
//   3. invokeHandlerForTest(input.handler)  -> THE HANDLER   -> an expected outcome
//   4. res.writeHead / res.end              -> the harness   -> a harness defect
//
// so: an allowlist over "any error from this block" is impossible, AND an allowlist over
// "a throw from step 3" is trivial once the throw is tagged where it happens.
const response = await HandlerEscapedError.tag(() => invokeHandlerForTest(…));
```

the prior argument was true of the block and false of the design. the re-read found the second
population, and the fix followed in minutes.

## .enforcement

- a find refuted for a **second** time, where the round between changed no code in the cited file =
  **blocker** (re-read the subject before the refutation is accepted)
- a refutation that cites the author's own prior `.taken` as its support = **blocker**
- a refutation pitched only at a general claim, where the find supplied a concrete case =
  **blocker** (answer the case)
- one refutation offered against the same find from multiple reviewers, with no note that they
  converged = **nitpick**
- a refutation that records a fresh re-read of the subject and still holds = false positive (that is
  this rule satisfied)
- a reviewer rubric misfire whose **specific false premise** is named = false positive

## .see also

- `rule.always.converge-with-reviewers` (driver) — the sanction to hold your ground; this rule bounds
  it and asks for a re-read first
- `rule.require.sweep-the-defect-class` — the same **conflated-subject** flaw, seen from the other
  side: there a sweep grepped one form of a two-form cause; here a defense held one subject of a
  two-subject block
- `rule.require.deferred-defect-records-lead-with-status` — the peer illusion: prose that fully
  describes a fix reads as the fix. here, prose that fully defends a design reads as a sound design
- `rule.require.trust-but-verify` (mechanic) — verify an inherited claim; the claim hardest to
  verify is the one you wrote yourself
- `rule.require.review-attempts-deletion` — "what did I change last time?" is a deletion question
