# F8 — a 429 is a throttle, not a refusal

- **fork**: (a) a 429 follows the refusal opt, as every other 4xx does · (b) a 429 is a `MalfunctionError` under either opt
- **taken**: (b). a refusal is a verdict on the request: a retry of the same bytes fails the same way (`domain.terms/refusal.md`). a 429 breaks that sense: the same bytes succeed after `retry-after`. so it is a server-side fault the caller waits out, never a request it must fix
- **where**: `asErrorFromHttpResponse.ts` (one branch ahead of the 4xx branch); clamp in `asErrorFromHttpResponse.test.ts` ("a 429 is a throttle, never a refusal"), under both opts
- **rework**: clean. delete one branch to fold a 429 back into the refusal arm; no caller is hardened against it, since the 429 cast is new to this pr either way
- **confidence 90%, why not higher**: a consumer that opted into pass-through got a `ConstraintError` for a 429 before this pr, and now gets a `MalfunctionError`. under pass-through that is a change to the old behavior; it is the correct class, yet it is one more break to list in the pr body
- **raised by**: peer review r1 (repo-rules) blocker.2, round i001; re-raised by r12 (enroll-verif-test-intent) blocker.1, round i004, which asks that the wisher sign off on the pass-through break
- **verdict**: disputed — handed to the commander as a third call in the pr body (`## 🔱 for the commander`, F8)
