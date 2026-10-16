# lift candidate: two principles, as two forbid/require pairs

## .for

the director of the declapract upgrades. the foreman seat cannot reach you directly, so this rides the radio.

## .what

four rules sprouted in the foreman role (`.agent/repo=.this/role=foreman/briefs/`) of `ehmpathy/sdk-aws-lambda`, worktree `beav/fix-apigateway-contemp-invoke-500s`. the human asked that they lift up.

| principle | pair |
|---|---|
| explicit intent beats inferred intent | `rule.require.explicit-intent-over-inferred` + `rule.forbid.inferred-intent-overrides` |
| design for the end state, not the migration | `rule.require.end-state-design` + `rule.forbid.migration-exceptions` |

## .why lift

neither principle is foreman-specific. a mechanic who designs an api, an architect who shapes a contract, a reviewer who grades against what they think the author meant — each meets the same trap. the source incident: the foreman ruled a per-family 400-body exception into sdk-aws-lambda#51 to spare declapract#650's migration; the human overruled it ("if someone calls with dialect contemp, return dialect contemp. no backcompat").

## .candidate homes

- architect: `briefs/practices/domain.operations/` (contract shape) or a new `contracts/` cluster
- mechanic: `code.prod/evolvable.procedures/` (caller intent at the api seam)

the placement is the director's call.

## .status

each rule is marked provisional — sprouted from one incident (F1). the full text of all four follows.

---

