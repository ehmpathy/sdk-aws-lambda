# rule.forbid.ungrounded-type-params

## .what

a type parameter is a **name**, and it obeys the same ubiqlang as every other name. every
`T*` must trace to a term the repo or domain already holds. do not invent a vocabulary inside
angle brackets.

## .why

type parameters slip past review because they read as syntax rather than as vocabulary. a
reviewer who would reject `const raw = ...` or `interface Wire {}` will wave through
`<TRaw, TWire>` in the same proposal — so `<>` becomes the one place in a codebase where name
discipline lapses.

the cost is the same as any bad name, only harder to see:

- **the reader cannot decode the signature.** `Translate<TRaw, TInput, TOut, TWire, TSpec>`
  gives five tokens and one recognizable term. the reader must reverse-engineer four from the
  body.
- **a synonym enters through the back door.** `TOut` beside an extant `TOutput` is two words
  for one concept (`rule.forbid.term.addition.synonym`) — and because it is a type parameter,
  no one greps for it.
- **the abbreviation hides a real question.** `TRaw` names the vague quality "unprocessed"
  instead of the actual value. the case that produced this rule had a *verified* domain term
  available — `payload` — and the abbreviation concealed that fact, which in turn produced a
  false claim that the type could not be symmetric.

measured on this stone: four of five parameters were invented, and a grep found the repo has
exactly **two** type-parameter names in total. the invented set outnumbered the real one 2:1.

## .the test — for the proposer

before you write a type parameter, grep the repo for the term without its `T`:

- **found** → use the extant name verbatim; do not shorten it, and do not "improve" it
- **absent** → you are about to add a domain term, so the term is now a **ubiqlang proposal**
  and owes what any term owes: a source in the domain, or a compound of terms already held
  (`rule.require.domain-discovery-for-term-proposals`)

then check three specifics:

| check | example of the failure |
|---|---|
| no truncation of an extant name | `TOut` where `TOutput` exists |
| no vague quality-word in place of the value | `TRaw`, `TData`, `TVal`, `TObj` |
| the parameter order tells the dataflow | `<TIn, TSpec, TOut>` where the pipeline is in→out |

a compound of extant terms is legitimate and often best: `TPayloadInput` is `payload` (a held
term) plus `input` (the member it types), so it needs no discovery of its own.

## .the test — for the reviewer

**read the angle brackets as prose.** for each `T*`, grep the term without the `T`. zero hits
outside the proposal = the name was invented, and the defect stands whether or not the shape
is right.

**then read one level up.** the bound interface, the wrapper type, and every member name owe the
same trace. a proposal can pass the `T*` check and still smuggle an invented word in as the bag's
name — that is how `TranslatePipeline` survived three review passes on the case that produced
this rule, in the same document that states it. **the one-level-up position is where the defect
recurs**: on that case it produced three name defects in a row (`TranslatePipeline`, then
`payloadInput`, then `TranslateMember`), each caught by the human and none by a self-review.

the tells:

- a parameter list where **most** tokens are absent from the repo — the vocabulary was authored
  at the keyboard
- a `T` prefix on an adjective or a quality (`TRaw`, `TPlain`, `TFull`) rather than on a noun
- a short form beside a long extant one (`TOut` / `TOutput`, `TCtx` / `Context`)
- a parameter the proposal must **explain in a comment** to be readable — the same tell as
  `rule.forbid.names-that-mash-dimensions`
- more than three parameters, with no rationale for their order
- **a name that names its own container** — see below

and the deeper move: an abbreviated parameter can **hide a design defect**. when a name is
vague, no one asks whether the right term exists — and the right term often carries a
capability the vague one appears to lack. so treat a vague `T*` as a prompt to ask *what is
this value, in the domain's words?* rather than only as a style nit.

## .the tell that a name names its own container

a name may trace to a real repo term and still say **not one thing** about the value, because
the term it traces to describes the code's own structure rather than the domain.

`TranslateMember` was extracted for the tri-state `Translator<TFrom, TInto> | false`. `member`
*does* appear in the repo — 6 times, every one a local variable inside codegen that emits
TypeScript object literals. so its only extant sense is *"a property in generated source"*:
syntax jargon, not domain vocabulary. the name therefore reads as **"a property of
`Translate`"** — it names its own container.

the container-word family, none of which is a domain term:

| word | what it actually names |
|---|---|
| `Member`, `Field`, `Prop`, `Key`, `Entry` | a slot in the enclosing type |
| `Item`, `Element`, `Node` | a slot in the enclosing collection |
| `Config`, `Options`, `Params`, `Args` | "the things passed to the thing" |
| `Wrapper`, `Holder`, `Container`, `Box` | the enclosure itself |

**the reviewer test:** read the name with its container hidden. `Member` alone tells a reader
zero. `Translator` alone tells them the value re-renders one shape as another. if the name only
makes sense *beside* the type it lives in, it names the container, not the value.

**and one prompt that usually settles it:** try to name the thing three ways. if every candidate
is either container-jargon or a rule break — `TranslatorOrOff`, `DisarmableTranslator`,
`TranslateOption` — that failure is evidence, not a naming block. **when no name fits, there is
usually no concept there.** delete the alias; a union of two extant types needs no third name,
and the doc-comment that explains the states belongs on the type a reader actually meets.

this is also where `rule.prefer.wet-over-dry` bites: an alias with 2 usages is below the
rule-of-three, so the extraction bought a name to maintain while it hid no complexity worth a
name.

## .the companion move — bind the terms structurally, not positionally

a grounded name is necessary and not sufficient. **positional** type parameters leave the
vocabulary to discipline: a reader counts slots, and a later edit can add, drop, or reorder one
with no complaint from the compiler.

when a type has **three or more** domain-specific parameters, prefer one parameter whose members
are named, bounded by an interface that declares them:

```ts
export type Translator<TFrom, TInto> = (from: TFrom) => TInto;

export interface LambdaEndpointShapes {
  inputBefore: unknown;   // before the input translator
  inputAfter: unknown;    // after  the input translator
  outputBefore: unknown;  // before the output translator
  outputAfter: unknown;   // after  the output translator
}

export interface Translate<TShapes extends LambdaEndpointShapes> {
  input?: Translator<TShapes['inputBefore'], TShapes['inputAfter']>;
  output?: Translator<TShapes['outputBefore'], TShapes['outputAfter']>;
}
```

⚠️ **an earlier draft of this brief used `payloadInput` / `payloadOutput` here, and those names
traced fine yet were still wrong** — each asserted a property of the value (`payload` is AWS's word
for that slot) that another trigger would falsify. a position asserts no property at all. that is
the counterweight rule, `rule.prefer.names-by-position-over-claim` — a name must trace **and** must
not assert.

⚠️ **the bound interface needs a traced name too.** a draft of this brief called it
`TranslatePipeline` — an invented mechanism-word, in the very brief that forbids them. the rule
covers **the bound interface and its members**, not only the `T*` slots. `LambdaEndpoint` is the
repo's core domain entity and `shape` is extant vocabulary (`rule.require.shapefit`), so
`LambdaEndpointShapes` traces where `TranslatePipeline` did not.

**and name the function, not only the types.** the same draft typed the members as bare arrow
signatures while `asPayloadTranslator` already sat in the nearby design. if the codebase speaks
of a translator, the type is `Translator` — an anonymous `(from) => into` discards a term you
already own. a two-parameter utility like this needs no per-slot domain term (see the caveat),
but it does need its own name.

the `extends` clause is a **structural bind to the terms**: a consumer cannot express the type
without a value for every member, so the **compiler** holds the vocabulary rather than a
reviewer. that is a constraint against future deviation, which a positional list cannot offer.

the payoff is concrete. on the case that produced this rule, **every design defect was a
conflation of one adjacent pair** — wire-payload with handler-input, and handler-output with
wire-payload. the second of those was the root defect the whole work existed to fix. a design
that leaves the pairs unnamed invites the next conflation; one that cannot compile without both
terms present prevents it.

two notes on the mechanics:

- **bound with `unknown`, bind with a real type or `never`.** `unknown` in the interface says
  "any type satisfies this member". to *bind* `unknown` into a union is a silent hole
  (`unknown | fn` widens to `unknown`), so a member with no value for a given consumer binds
  `never`, which is the union identity.
- **the cost is a noisier declaration** — indexed accesses, slightly worse mismatch errors. the
  trade holds because a declaration is read once and a bind site many times, and the bind sites
  are where conflations happen.

## .the caveat

- **single-parameter idioms are fine.** `Ref<T>`, `Maybe<T>`, `PickOne<T>` where `T` is
  genuinely any type need no domain term, because the type is genuinely domain-agnostic.
- **`T` alone is fine** in a truly generic utility for the same reason.
- the rule fires when a parameter names a **domain-specific** value — a payload, an event, a
  response — and does so with an invented word.
- **one or two positional parameters need no bag.** the named-bag move earns its ceremony at
  three or more, or wherever two parameters are adjacent and confusable.
- **do not delete the parameterization to dodge the name problem.** that over-correction is its
  own defect: it makes the types anonymous, so the vocabulary vanishes entirely. ask "does a
  *consumer* vary this?" — and count the **families or call sites** that instantiate the type,
  not only the end user. a type at a shared ancestor is varied by its descendants, so its
  parameters are real even when each descendant binds a constant.

## .examples

### 👎 bad — four invented names, one real

```ts
export interface Translate<TRaw, TInput, TOut, TWire, TSpec> {
  input?: TSpec | ((raw: TRaw) => TInput);
  output?: (out: TOut) => TWire;
}
// TRaw / TOut / TWire / TSpec appear nowhere in the repo.
// TOut is a truncation of the extant TOutput — a synonym, unsearchable.
```

### 🤔 better — every name traces, but the shape is still positional

```ts
export interface TranslatePayload<
  TPayloadInput,   // `payload` (extant, bidirectional) + the member name
  TInput,          // extant — both factories
  TOutput,         // extant — both factories
  TPayloadOutput,  // `payload` + the member name
> {
  input?: (payload: TPayloadInput) => TInput;
  output?: (response: TOutput) => TPayloadOutput;
}
// reads as the pipeline: TPayloadInput -> TInput -> [invoke] -> TOutput -> TPayloadOutput
```

this passes the grep test — every token traces. it still carries **two** defects the rule's
companion moves catch: four positional slots a reader must count (fixed by the bound bag above),
and names that **assert** a property of the value rather than state its position (fixed by
`rule.prefer.names-by-position-over-claim`).

### 👍 good — traced, bound, and positional in name

```ts
export interface Translate<TShapes extends LambdaEndpointShapes> {
  input?: Translator<TShapes['inputBefore'], TShapes['inputAfter']>;
  output?: Translator<TShapes['outputBefore'], TShapes['outputAfter']>;
}
// one parameter, structurally bound; every member names a position, so no
// vendor convention or later decode step can falsify it
```

## .enforcement

- a type parameter whose term appears nowhere in the repo or domain = **blocker**
- a truncation of an extant type-parameter name = **blocker** (a synonym)
- a `T` prefix on a vague quality where a domain noun exists = **blocker**
- a type or parameter named for its **container** (`*Member`, `*Field`, `*Item`, `*Wrapper`)
  rather than for the value = **blocker**
- an alias extracted below the rule-of-three whose name no candidate fits = **blocker** (delete
  the alias, keep the doc-comment on the type a reader meets)
- a parameter list of 4+ with no stated rationale for their order = **nitpick**
- `T` / `TItem` in a genuinely domain-agnostic utility = false positive
- a container-word that IS the domain's own term (a `Node` in a real tree domain, an `Entry` in
  a real ledger domain) = false positive

## .see also

- ⚖️ **`rule.prefer.names-by-position-over-claim` — the COUNTERWEIGHT.** a name must trace **and**
  must not assert. applied alone, this rule approves `payloadInput` — a name that traces to a real
  repo term and still asserts a property another consumer would falsify. read the pair together
- `rule.require.ubiqlang` (mechanic) — the rule this applies inside angle brackets
- `rule.forbid.term.addition.synonym` (architect) — `TOut` beside `TOutput`
- `rule.require.domain-discovery-for-term-proposals` (architect) — what a genuinely new term owes
- `rule.forbid.names-that-mash-dimensions` — the twin name rule; shares the "it needs a gloss" tell
- `rule.require.retest-the-model-on-every-family` — a bind cannot hold a vocabulary the model gets wrong
- `rule.prefer.wet-over-dry` (mechanic) — why an alias below the rule-of-three earns no name
- `rule.require.review-attempts-deletion` — "what would a reader who never saw my notes read this as?"
