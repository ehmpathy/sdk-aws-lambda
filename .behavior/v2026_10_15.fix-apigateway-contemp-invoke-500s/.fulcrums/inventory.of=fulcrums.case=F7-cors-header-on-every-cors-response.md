# F7 — the cors allow-list change reaches every cors response, not only OPTIONS

## .the fork

F6 (ruled) appends `x-trail-exid` to the cors `Access-Control-Allow-Headers` list. the vision priced
that as *"a visible header diff on OPTIONS responses (not on the ancient request path)"*. execution
measured otherwise.

## .what execution measured

`@middy/http-cors` stamps `Access-Control-Allow-Headers` on every response of a cors-configured
endpoint, success included — not only a preflight. so four snapshots moved, one line each:

- `genLambdaEndpoint.forApiGateway.test.ts` `[case3]`, `[case18]`, `[case19]` (v1 and v2)
- `blackbox/local.httpResponse.acceptance.test.ts` `[case8]` — a real http response over the harness

each diff is the single line `content-type,authorization` → `content-type,authorization,x-trail-exid`.
no other byte moved on any ancient-path response.

## .taken = update the four snapshots, and say so

- the foreman's condition 4 said *any snapshot diff on the ancient path is a stop*. these diffs are
  the exact, intended consequence of the wisher's F6 decision, which came after that condition:
  *"yes, it should - since we expect it"*. this record satisfies the stop, and the wisher decides
  whether to keep F6 or narrow it
- the vision's OPTIONS-only claim was wrong. it is corrected here; the approved vision is not rewritten

## .what a browser sees

a response to a cors-configured endpoint now advertises one more allowed request header. no request
that omits `x-trail-exid` changes in any other way.

## .rework = clean

drop the `asCorsHeadersWithTrail` call in `corsInputToCorsConfig`, delete its file, and revert four
snapshot lines.

## .confidence = 70%, low because

- the wisher approved the header list change from a premise (preflight only) that execution
  disproved. the effect is small, but it was the wisher's to weigh with the true scope

## .verdict

open — for the wisher. keep F6 as built, or narrow it to the default list only (which still moves
the same four snapshots), or drop it (an opted-in browser then fails its preflight).
