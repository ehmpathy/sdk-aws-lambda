# F7 — the version this contract break cuts

- **fork**: (a) `feat(...)` commit → please-release bumps minor → v0.8.0 · (b) `break(...)` commit → bumps major → v1.0.0
- **taken**: (a). under 0.x semver a minor bump is the break signal, and this repo shipped its prior 0.x contract breaks as `feat` (#46 changed the invoke input shape at 0.x). a v1.0.0 declares the surface stable, a call larger than this fix
- **evidence**: `.github/actions/please-release/action.yml:179-185` — `^break` → major, `^feat` → minor, else patch. `git log` shows no `break:` commit
- **rework**: clean — the commit header type, before merge
- **confidence 85%, why low**: consumers pin exact versions (rule.require.pinned-versions), so either cut is safe; the 1.0 call is the commander's
- **where**: the squash commit header of the pr
- **verdict**: best-guessed; listed in the pr body
