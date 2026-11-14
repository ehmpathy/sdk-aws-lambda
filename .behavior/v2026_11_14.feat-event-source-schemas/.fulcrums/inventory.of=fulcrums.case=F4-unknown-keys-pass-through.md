# F4 — unknown aws keys pass through

## .the fork

- **strip** (`z.object`, zod's default) — a field aws adds vanishes from the handler's view
- **strict** — a field aws adds refuses every event: a self-inflicted outage on an aws release
- **pass through** (`z.looseObject`) — known keys validated, unknown keys kept

## .taken: pass through

aws owns the envelope and adds fields over time. validation guards what the sdk declares; it must
not delete or refuse what aws sends. `define.lambda-event-source`: wire-faithful by default.

## .rework: clean

## .confidence: 88%

## .verdict

best-guessed.
