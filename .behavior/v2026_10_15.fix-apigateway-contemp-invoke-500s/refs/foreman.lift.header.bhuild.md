# lift into the foreman role: two principles, as two forbid/require pairs

## .what

four rules sprouted in the foreman role (`.agent/repo=.this/role=foreman/briefs/`) of `ehmpathy/sdk-aws-lambda`, worktree `beav/fix-apigateway-contemp-invoke-500s`. the human asked that they land in this repo's foreman role.

| principle | pair |
|---|---|
| explicit intent beats inferred intent | `rule.require.explicit-intent-over-inferred` + `rule.forbid.inferred-intent-overrides` |
| design for the end state, not the migration | `rule.require.end-state-design` + `rule.forbid.migration-exceptions` |

## .why the foreman

the foreman answers a driver's judgment calls. these are the two checks that would have turned its first wrong verdict right: the foreman ruled a per-family 400-body exception into sdk-aws-lambda#51 to spare declapract#650's migration; the human overruled it ("if someone calls with dialect contemp, return dialect contemp. no backcompat"). a foreman that runs both checks before each verdict decides these forks itself.

## .note — no foreman role on main yet

`origin/main` holds no foreman role. it is sprouted in-repo (its brief: "SPROUTED, not designed"). land these with the foreman role when it is promoted, as its first rules beyond `im_a.foreman.md`.

a parallel task carries the same four rules to `ehmpathy/rhachet-roles-ehmpathy` (architect / mechanic), since neither principle is foreman-specific.

## .status

each rule is marked provisional — sprouted from one incident (F1). the full text of all four follows.

---

