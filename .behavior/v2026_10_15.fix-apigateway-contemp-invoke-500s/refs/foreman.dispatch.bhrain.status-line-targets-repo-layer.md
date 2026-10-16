# fix(driver): init.claude.status-line writes the layer rhachet discards, so the status line vanishes on enroll

## .symptom

a driver clone in `ehmpathy/sdk-aws-lambda` ran with no route status line (no `🗿 <stone>` at the foot). the human: "how come the status line is not bound for the driver?"

the bind existed once. the actor's brain dir holds `.bak` snapshots from 2026-10-15 00:00 and 03:51 with:

```json
"statusLine": {
  "type": "command",
  "command": "node -e \"import('rhachet-roles-bhrain/cli/route').then(m => m.routeStatusLine())\""
}
```

the live `settings.json`, `settings.of.grove.json`, and `settings.of.repo.json` held none.

## .the cause — two tools, one file

`dist/domain.roles/driver/inits/init.claude.status-line.sh:31`:

```bash
SETTINGS_FILE="$GITROOT/.claude/settings.json"
```

it merges `statusLine` in via temp + `mv`, which replaces the file.

rhachet (1.49.x, `setBrainDirSettingsLayout`) reserves that name:

> `settings.of.grove.json -> ~/.claude/settings.json`, `settings.json -> settings.of.grove.json`, and `settings.of.repo.json` as the one real file … a real file where an arrow belongs — a role init's temp + rename over `settings.json` … is replaced by the arrow. it is neither merged into `settings.of.repo.json` nor kept aside

so the init writes `statusLine` into `settings.json`; the next enroll restores the arrow; the status line is gone, and neither side says so.

## .a second fault — the init binds the wrong actor

`$GITROOT/.claude` is one symlink, to one actor's brain dir (here `.agent/.actors/actor.via.repo=ambient/brain/.claude`). a repo holds many actors (`@repo=ambient`, `@hash=7dcf1989`, `@hash=9366365e`, …), each with its own brain dir. so the init binds whichever actor that link names — never "the clone that runs me". for any other actor, the status line lands in a peer's settings.

## .the fix — the wisher's spec

write into **the brain dir of `rhx clone whoami`**, against its `settings.of.repo.json`:

```bash
# the clone that runs this init — its own actor
ACTOR_EXID="$(npx rhachet clone whoami --output json | jq -r '.actorExid')"   # e.g. hash=7dcf1989
BRAIN_DIR="$GITROOT/.agent/.actors/actor.via.${ACTOR_EXID}/brain/.claude"
SETTINGS_FILE="$BRAIN_DIR/settings.of.repo.json"
```

`settings.of.repo.json` is the layer rhachet derives from the roles and hands claude via `--settings`; rhachet findserts it and never replaces it, so the bind survives an enroll.

`whoami` output today:

```json
{ "serial": "5d8e5163-…", "slug": "foreman", "reachState": "LIVE", "actorExid": "hash=7dcf1989" }
```

## .open — for the bhrain owner

- **no clone.** `whoami` runs "from within a clone". an init run from a bare human shell has no clone to name. fail loud (`ConstraintError`, exit 2, with the fix), or bind every actor in the repo — never silently fall back to `$GITROOT/.claude`.
- **the brain dir path.** to build `actor.via.<exid>/brain/.claude` by hand couples bhrain to rhachet's layout. if rhachet can expose the brain dir directly (a `whoami` field, or an env var on the clone), read that instead.

## .the local patch, for reference

sdk-aws-lambda carries a stopgap: `SETTINGS_FILE="$GITROOT/.claude/settings.of.repo.json"`, run via `npx rhachet run --repo bhrain --role driver --init init.claude.status-line` → `status = configured`. it fixes the layer, not the actor — it reached the driver only because `.claude` happens to name the driver's actor.

## .the clamp

- run the init, then the layout findsert (`rhx enroll` or `setBrainDirSettingsLayout`) → `statusLine` survives in `settings.of.repo.json`
- revert the target to `settings.json` → the same sequence drops it (red); restore → green
- a repo with two actors, `.claude` linked to actor A, init run from a clone of actor B → `statusLine` lands in B's `settings.of.repo.json`, and A's is untouched
- init run with no clone → exit 2, no file written
- the skip-and-warn path (a human's own `statusLine`) still reads the human's layer, wherever it lives

## .also — for rhachet

the layout findsert drops a role init's write in silence. a one-line notice ("replaced a real `settings.json` with the grove arrow; a role init wrote here — role settings belong in `settings.of.repo.json`") would have named this in one read. other role inits that target `.claude/settings.json` hit the same trap (e.g. the ehmpathy `init.claude.permissions.sh` mechanism this init mirrors) — worth a sweep.

---

dispatched by @:foreman, sdk-aws-lambda, at the human's ask
