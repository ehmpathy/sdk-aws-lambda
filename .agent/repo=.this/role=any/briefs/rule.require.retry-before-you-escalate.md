# rule.require.retry-before-you-escalate

## .what

a resource's state is a **read**, never a property. so an escalation that rests on one — *"the
credential is locked"*, *"the gate is closed"*, *"the service is down"* — owes a **fresh read, taken
at the moment of the escalation**, not the one that first stopped you.

```
# 👎 the read is taken once, then converted into a claim about the world
[t0]  rhx keyrack status --owner ehmpath   ->  AWS_PROFILE absent
[t0]  "AWS_PROFILE is locked"                                      <- true, a read
[t1]  "AWS_PROFILE is a HUMAN-ONLY GATE; a human must click sso"   <- FALSE, a property
[t2]  ...written into 3 review responses and 2 yield rows, over 3 iterations, never re-read

# 👍 the read is re-taken at the moment it is used
[tN]  rhx keyrack status --owner ehmpath   ->  expires in 47m      <- live. just run the suite.
```

## .why

an escalation is the one claim a robot makes that **no one will test**. every other claim meets a
compiler, a test, or a reviewer who can check it. *"I am blocked"* meets none of those — a human reads
it and acts on it, because the whole point of an escalation is that they hold what you do not.

so the escalation path is exactly where the discipline lapses, and it lapses for a reason that feels
like rigor:

- **a blocker feels like a find rather than like a claim.** you saw the lock. what you saw was real.
  what you then wrote was a different sentence — a claim about the world's structure — and it carried
  the observation's confidence without its evidence.
- **state decays in the direction that unblocks you.** a lock expires, a session refreshes, a quota
  resets, a deploy finishes, a rate limit clears. so the time between your read and your escalation is
  *biased toward the escalation being unnecessary* — the opposite of the intuition that a blocker is
  a stable fact.
- **thoroughness makes it worse.** a well-argued escalation that enumerates what you did NOT do,
  measures the gate's over-broad reach, and cites the brief that forbids each workaround reads as
  *settled*. every paragraph of correct work raises the apparent cost of one cheap re-check.

measured on the case that produced this rule: a locked-credential read became *"a human-only gate"* and
survived **three iterations** of ever more thorough documentation — among them a genuine, correct
measurement of a real over-broad gate — while its refutation was **one command, already in the
allowlist, that I never re-ran.** the human ran it and it read `expires in 54m`. the suite then passed
242/242 on the first try.

## .the test — for the proposer

before you write *"blocked"*, *"human-only"*, or *"I cannot"*: **when did I last read this, and have I
read it since?**

| what you hold | verdict |
|---|---|
| a read taken **just now**, in this turn | ✅ escalate, and cite the command + its output |
| a read from earlier in the session | **re-take it first** — it costs one command |
| a read you have re-taken and re-confirmed | ✅ escalate, and say how many times you retried |
| a conclusion you wrote down, with no read behind it in this turn | **stop.** you are about to escalate a memory |

then check the second axis — **is the state time-bound?** a credential, a session, a quota, a lock, a
deploy, a network route, a rate limit, a CI queue. every one of those expires by design, so a stale
read of one is worthless. a file's contents or a type's shape age better.

and one shortcut tell: **your escalation is about to run longer than a paragraph.** length means you
have been at this a while, which means your read is old.

## .the test — for the reviewer

for every *"blocked"* / *"cannot"* / *"human-only"* claim in an artifact: **what command proves this is
true NOW?**

- a command and its output, dated to this turn → the escalation is founded
- a command from an earlier phase, cited as though current → **flag it; ask for a re-run**
- no command at all → **flag it harder**; the claim cannot even be audited

the tells:

- an escalation that spells out the **remedy** in detail (`rhx keyrack unlock --owner ehmpath --env
  prep`, then approve the browser prompt) — a well-specified remedy reads as a well-verified blocker,
  and the two are unrelated
- an escalation that has **survived more than one iteration** with no fresh read in any of them
- an escalation whose backing work went *deeper* (measured the gate, read the source, cited the brief)
  while the **cheap** check went unrepeated
- a claim about a **time-bound** resource, stated in the present tense, sourced in the past tense

## .the caveat

- **this is not "retry forever".** a genuine human-only gate exists — a yubikey touch, an approval, a
  credential no automation holds. the rule asks for **one fresh read at the moment of the escalation**,
  never an unbounded loop.
- **it is not a licence to route around a gate.** the keyrack discipline stands: do not find
  workarounds, do not skip credentials, do not relax a safety gate so your own tests can run. retry the
  sanctioned path; do not invent an unsanctioned one.
- **a read that is genuinely fresh needs no repeat.** if you checked in this turn, cite it and go.
- **some blocks do not decay** — an absent permission grant, a deleted branch, a repo that does not
  exist. the rule bites hardest on the time-bound class, and the tell is whether the resource expires.

## .the companion — say how you checked, so a human can correct you in seconds

an escalation that carries its command is one a human can falsify at a glance. an escalation that
carries only a conclusion forces them to reconstruct your logic before they can disagree with it.

```
# 👎 a conclusion, unfalsifiable without work
🚫 BLOCKED — AWS_PROFILE is a human-only gate; needs a browser sso click.

# 👍 a read, falsifiable at a glance
🚫 BLOCKED — `rhx keyrack status --owner ehmpath` (re-run just now) lists no AWS_PROFILE row.
   retried the suite once after; same failure. unlock is `rhx keyrack unlock --owner ehmpath --env test`.
```

## .enforcement

- an escalation about a **time-bound** resource with no read taken in the same turn = **blocker**
- an escalation carried across iterations with no fresh read in any of them = **blocker**
- an escalation that states a **property** (*"is a human-only gate"*) where the evidence supports only
  an **observation** (*"read as locked at 14:02"*) = **blocker**
- an escalation with no command recorded = **blocker** (it cannot be audited, per
  `rule.require.positive-control-before-absence-claims`)
- an escalation whose remedy is well-specified and whose read is stale = **blocker** (the remedy's
  quality is no evidence of the blocker's currency)
- a fresh read, cited, plus a retry = false positive (that is this rule satisfied)
- a genuinely non-expiring block (an absent grant, a deleted resource) = false positive

## .see also

- `rule.require.positive-control-before-absence-claims` — the twin: an **absence** claim owes a control
  that proves the tool can see. this one: a **blocked** claim owes a read taken now. both fire when a
  stale or unproven observation is mistaken for a fact about the world
- `rule.require.measure-the-value-you-emit` — the same family; there the false source is a vendor's
  type, here it is your own earlier read
- `rule.require.trust-but-verify` (mechanic) — verify an inherited claim; the claim hardest to verify
  is the one **you** wrote, because you remember the moment you saw it
- `rule.require.deferred-defect-records-lead-with-status` — the peer illusion: thorough prose about a
  fix reads as the fix. here, thorough prose about a block reads as a verified block
- `rule.always.converge-with-reviewers` (driver) — escalate only for a genuine wall; this rule bounds
  what counts as genuine
- `howto.keyrack` — `--owner ehmpath` is mandatory; without it a read hits the human's yubikey rack and
  returns a false lock, which is a second way one read can lie
