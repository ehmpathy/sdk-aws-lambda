# F3 — the inner message is decoded in place

## .the fork

- **A** validate only: `Message` stays a json string; the schema refines that it parses and matches.
  output type is exactly `SNSEvent`
- **B** decode in place: `Message` becomes the validated `TPayload`. the wire face stays `SNSEvent`;
  the handler's face is `SNSEvent` with `Message: TPayload`

## .taken: B

under A the handler re-parses a string the schema already parsed, and gets `any` back — an
unvalidated parsed body beside a validated one (`domain.terms/payload.md`: "a handler that re-parses
where payload serves = blocker"). `forAsk` is codec-aware (`TInput` vs `TInputBefore`), so B costs no
cast: the returned handler accepts `SNSEvent`; `invoke` receives the decoded shape.

with no `payload` schema, B and A coincide: the output is exactly `SNSEvent`.

## .rework: clean before release, dirty after

once consumers read `Message.surferId`, a flip to A breaks every one.

## .confidence: 88%

the wish says "the inner message the handler decodes" — read literally, the handler decodes, which is
A. B follows the repo's own payload law, and both evidenced consumers want the decoded value. the
residual doubt is the wisher's phrase.

## .verdict

answered by repo law and evidence (yield q4): `domain.terms/payload.md` forbids a re-parse where
`payload` serves, and both evidenced handlers pass the decoded value straight onward. the wisher may
still overrule; the rework stays clean until release.
