# fix: clone say withholds every message when the input box's top rule carries a title

## .symptom

`rhx clone say @:mechanic` returns `withheld` / `focus-unrecognized` on every attempt, against a healthy, idle peer whose box is clear. the hint then advises a teardown and re-enroll — which would discard the peer's whole context (here, ~420k tokens of route work) for a defect that is not the peer's.

measured 2026-10-15, rhachet 1.49.2, in `ehmpathy/sdk-aws-lambda` worktree `beav/fix-apigateway-contemp-invoke-500s`. six consecutive says, all withheld. the foreman's messages never reached the mechanic; the human relayed them by hand.

## .the cause

`computeCloneInputState.js` → `getInputBand` needs two rule rows. `isRuleRow` accepts only a bare rule:

```js
const isRuleRow = (line) => {
    const trimmed = line.trim();
    return /^─+$/.test(trimmed) && trimmed.length >= 20;
};
```

claude code now draws the session name into the box's TOP rule. the captured viewport (`.agent/.cache/repo=rhachet/skill=clone-say/debug.2026-10-15.log`, rows 52–55):

```
52 │──────────────────────────── … ─────────────── mechanic ─│
53 │❯│
54 │──────────────────────────── … ──────────────────────────│
55 │  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents│
```

row 52 fails `/^─+$/`. only row 54 counts. `ruleRows.length < 2` → `band = null` → `focus: 'unrecognized'`. the classifier was measured against claude v2.1.87, which drew no title.

## .the fix

accept a rule that carries a title — a run of `─`, an optional ` <label> ` segment, a final `─` run:

```js
const isRuleRow = (line) => {
    const trimmed = line.trim();
    const ruleCharCount = (trimmed.match(/─/g) ?? []).length;
    return /^─+(?: [^─]+ ─+)?$/.test(trimmed) && ruleCharCount >= 20;
};
```

the `≥ 20` floor counts rule chars only, so a long label cannot satisfy it alone. `computeCloneInputContent`'s queue walk shares `isRuleRow`, so it inherits the fix.

## .the clamp

- a fixture screen with the titled top rule above (verbatim from the capture) → `focus: 'input'`, `input: 'clear'`
- revert the fix → the fixture goes red with `focus: 'unrecognized'`; restore → green (`rule.require.clamp-edge-cases`)
- a positive control: the v2.1.87 bare-rule screen still reads `focus: 'input'`
- a negative control: a prose row that holds `─` and words, under 20 rule chars, is not a rule

## .the patch does not reach a live clone

the classifier runs in the clone's host daemon (`socket/asCloneGetReplyFromScreen.js`), which keeps the module it loaded at enroll. a fix — local patch or release — reaches an already-live clone only after its host restarts, and `rhx clone` has no restart verb. so every clone enrolled before the fix stays deaf until torn down.

- add a way to reload a clone's host without loss of the brain session (e.g. re-attach to the same pty, or a `--resume` re-enroll)
- or classify on the CLIENT side from the raw screen the daemon sends, so the fix rides the caller's install

## .proof

the patched `isRuleRow` and `computeCloneInputState`, run against the exact rows 52–54 from the log, return `{ focus: 'input', input: 'clear' }`. the titled rule reads as a rule, the `❯` row does not, the bare rule still does.

the fix must land in every release line a dependency can pull — this tree resolved both 1.49.2 and 1.48.1. a host rebooted after only 1.49.2 was patched still withheld, so by elimination it loaded 1.48.1 (unconfirmed — no process trace was taken).

## .also

- the withheld hint says the measured causes are "permanent (a 0x0 pty geometry, or a detached host with no tty)" and advises a teardown. this case is neither. the hint should name a third cause — an unrecognized box chrome — and point at the debug log's rule rows before it advises a teardown that destroys a peer's context.

---

dispatched by @:foreman, sdk-aws-lambda, at the human's ask
