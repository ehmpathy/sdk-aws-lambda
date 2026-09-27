# F05 — `UnifiedApiGatewayEvent` KEEPS its name

**rework** clean · **status** 🔴 **RULED — keep**, per the wisher · **confidence** settled
(**A at 85% → B ruled → back to A.** two reversals; both kept on the record)

⚠️ the slug still says *"renamed-to-request"*. it is **stale and deliberately left so a second
time** — two renames of one file in one day is churn that hides the trail. the verdict is in this
line, not the filename.

## the verdict

```ts
event: UnifiedApiGatewayEvent     // ✅ the name it always had
```

## the three states, in order

| # | verdict | the reason given at the time |
|---|---|---|
| 1 | **keep**, 85% | *"a rename is a second public break for no measured gain"* |
| 2 | **rename** → `…Request` | 🔴 #1's break was **never measured** — it is **0 consumer files** (control: 101). and the noun flipped mid-pipeline: `…RequestPayload` → `…Event` → back |
| 3 | ✅ **keep** — RULED | 🔴 **F01 inverted.** the envelope field is `event`, so the type's `…Event` noun is now *correct*, and the mid-pipeline flip is fixed at the **other** end |

⇒ the answer returned to #1 and **not one of #1's reasons survived.** that is worth more than the
verdict: a correct conclusion from a false premise is indistinguishable from a lucky guess, and it
would have stayed unexamined if the wisher had not asked.

## 🔴 how #3 fixes the flip that #2 was raised to fix

#2 was right that the noun flipped. it picked the wrong end to repair.

```
before:  ApiGatewayRequestPayload ──▶ UnifiedApiGatewayEvent ──▶ event: TInput
              "Request"                    "Event" ⛔                (the body)

#2:      ApiGatewayRequestPayload ──▶ UnifiedApiGatewayRequest ──▶ event: TInput
              "Request"                   "Request" ✅               (the body — still narrowed!)

#3:      ApiGatewayEventWire      ──▶ UnifiedApiGatewayEvent  ──▶ payload: TInput
              "Event" ✅                  "Event" ✅                 (the body, named correctly)
```

⇒ #2 made the noun `Request` end to end by a rename of the **middle**. #3 makes it `Event` end to
end by a rename of the **ends** — and along the way frees `event` to mean what aws always meant,
which is what actually removes `rawEvent`'s cause.

⚠️ **#2 was a local fix to a global defect.** it would have shipped a coherent pipeline whose noun
was the *wrong* noun for a family aws calls events.

## the cascade, now

| now | after | consumer reach |
|---|---|---|
| `UnifiedApiGatewayEvent` | ✅ **unchanged** | 0 |
| `asUnifiedApiGatewayEvent` | ✅ **unchanged** | 0 |
| `genApiGatewayEventNormalizationMiddleware` | ✅ **unchanged** | 0 |
| `ApiGatewayRequestPayload` | 🔴 `ApiGatewayEventWire` | — |
| `ApiGatewayResponsePayload` | 🔴 `ApiGatewayResponseWire` | — |

⇒ the rename moved from the middle of the pipeline to its ends. same effort, opposite target.

## rework, and why clean

**clean.** type names only. and breakage was ruled not a cost by the wisher.

## where

- **F01** — the inversion that settled this one
- `1.vision.yield.md` → *the headline*, *what is awkward → 3*
- `.agent/repo=.this/role=any/briefs/domain.terms/payload.md` → why the `*Wire` qualifier

## the verdict, once ruled

🔴 **RULED — keep `UnifiedApiGatewayEvent`.** the wire-form types are renamed instead.

⇒ the lesson: **when a name looks wrong, check whether the name is wrong or its neighbour is.**
this entry spent two rounds on the middle term of a three-term pipeline, and the defect was at
both ends.
