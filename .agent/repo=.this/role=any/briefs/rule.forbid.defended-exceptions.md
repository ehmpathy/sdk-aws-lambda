# rule.forbid.defended-exceptions

> **when a set of peers should obey one rule and one member does not, a paragraph that explains why
> is not a justification — it is the defect, written down.**

## .what

a **defended exception** is a member of a set that breaks the set's own rule, kept by prose that
argues for the break. the prose is usually good — it names a real hazard and prices the
alternative — which is why it ships.

scoped to a **set**: a lone design choice that obeys no rule is just a choice.

## .why

a defended exception gains quality under review while its subject stays unchanged: each round the
author sharpens the argument, so the position looks scrutinized while the shape was never touched.

six briefs here hold a narrow copy of this rule, each scoped to one subject:

| brief | its tell | subject |
|---|---|---|
| `rule.avoid.constraints-the-state-already-proves` | *"a discovered constraint needs no essay"* | a type constraint |
| `rule.forbid.names-that-mash-dimensions` | *"the proposal explains the name"* | a name |
| `rule.require.illegal-states-unrepresentable` | *"prose that states a cardinality the type does not hold"* | a type |
| `rule.forbid.opposite-senses-on-undefined-and-null` | *"the prose is a confession"* | a sentinel |
| `rule.require.retest-the-model-on-every-family` | *"a reconciliation is a confession"* | a model |
| `rule.require.widen-before-parallel` | *"a confession that widen was skipped"* | a peer export |

this brief is the general form, for a subject none of the six covers.

## .the measured instance

`invoke`'s input bag on `forApiGateway`:

| slot | the rule | |
|---|---|---|
| `headers` | a projection of `event.headers` | ✅ |
| `payload` | a projection of `event.payload` | ⛔ no such slot existed |

a paragraph defended the absence: a validated value beside a parsed one would be one name at two
levels. the hazard was real; the shape was wrong. the hazard comes from an **unvalidated** slot, and
the chain already wrote the validated value back. one rename (`body` → `payload`) removed the
exception, the paragraph, and an `as`-cast.

the same branch held three such paragraphs (a fence around `request`, a local rename around
`event`, the deleted `payload` slot). each vanished when the shape was fixed; each fell to one
question from the wisher, never to a self-review.

## .the test — for the proposer

after you write *"this one is different because…"*, ask: **"what would have to change for this
member to obey the rule?"**

| answer | verdict |
|---|---|
| one rename, one field, one write-back | the paragraph is the defect — make the change |
| a domain asymmetry no edit removes | keep the paragraph, and name the **axis** that differs |

## .the test — for the reviewer

look for a paragraph that **defends** rather than states:

- *"this one is different"*, *"the exception is"*, *"unlike its peer"*
- a table whose last row needs a footnote the others do not
- a paragraph that improves across rounds while the code stays byte-identical
- a rule with N members and exactly one exception — the strongest tell. one exception is a defect;
  three are an axis not yet named

## .the caveat

a real asymmetry earns its paragraph when it names an axis. `forAsk` lifts no `headers`
because a direct invoke carries no metadata bag — a property of the transport. the paragraph names
the axis (*does the transport carry such a bag?*), not the odd member.

a caveat that sanctions an exception owes the same test: this slot once held *"headers is http-only"*
(false — kafka, amqp, mqtt carry the same bag) and *"the bag is reachable at `context.log.trail`"*
(a different concept). both read as axes; neither was.

## .enforcement

- a set member that breaks the set's rule, kept by prose = **blocker**
- a defense that improves across rounds while its subject is unchanged = **blocker**
- a rule with N members and one exception, no axis named = **blocker**
- an exception traced to an axis no edit removes = false positive

## .see also

- this is a local instance of a rule that belongs upstream (`ehmpathy/rhachet-roles-ehmpathy#804`,
  architect). delete this file once that brief lands
- `rule.require.review-attempts-deletion` — *"what would have to change?"* is a deletion question
- `rule.require.reread-the-subject-a-repeated-find-names` — the peer: an argument chosen for durability
- `rule.require.solve-at-cause` (architect) — the paragraph is the workaround; the shape is the cause
