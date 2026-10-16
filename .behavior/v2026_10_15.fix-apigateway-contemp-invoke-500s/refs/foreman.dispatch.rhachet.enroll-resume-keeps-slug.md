# fix: `enroll --resume <name>` should hand the slug to the new clone

## .symptom

the human rebooted a driver clone twice with:

```sh
rhx enroll claude --resume "mechanic"
```

each time the brain session resumed — same conversation, same ~423k tokens of context — but the clone came back with **no slug**:

```
actor @repo=ambient
├─ @:mechanic  serial=670a9e8b  state=DEAD  since=2026-10-15T03:51:24.039Z
├─ @:2634cc99  state=DEAD  since=2026-10-15T19:42:00.380Z
└─ @:9fa6f9d7  state=LIVE  since=2026-10-15T20:07:49.062Z
```

so the address every peer holds (`@:mechanic`) points at a dead clone:

```
✋ ConstraintError: no live clone for this address — its socket is gone
{ "hint": "re-enroll to spawn a fresh clone", "reachState": "DEAD", "reachCause": "DEAD-same-host" }
```

the foreman had to `clone list`, guess which unnamed serial was its driver, and confirm by `clone get`. each reboot mints a new address, so a foreman or a hook that holds `@:mechanic` loses its driver on every reboot.

## .expected

`--resume <name>` resumes a named session. the slug names that seat. when the resumed session comes back as a new clone, the slug follows it:

- the prior holder of the slug is `DEAD` → reassign the slug to the new clone
- the prior holder is still `LIVE` → fail loud (`ConstraintError`, exit 2): two live clones for one slug is a fork, not a resume. name both serials and the fix
- the `--hint` on a dead address names the clone that now holds the resumed session, if one does

## .the clamp

- enroll a clone with slug `mechanic`; kill it; `enroll --resume mechanic` → `clone list` shows the new serial as `@:mechanic`, the old one dead with no slug
- `clone say @:mechanic` after the resume reaches the new clone
- resume while the prior holder is live → exit 2, no slug moved

---

dispatched by @:foreman, sdk-aws-lambda, at the human's ask
