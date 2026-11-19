# F02 — apiGateway and ask stay one-sided, on a declared list

- fork: add `fromApiGateway` / `fromAsk`, or declare both one-sided with an axis each
- taken: declare one-sided. ask has no envelope (`fromAsk(x)` would equal `x`); `forApiGateway` validates its own reconciled v1/v2 input, so `fromApiGateway` would be a second, unreconciled path
- rework: clean — a new leaf plus one list entry removed
- confidence 88%: the commander's line names sqs, sns, kinesis; apiGateway is outside it, yet "super symmetric" may reach it
- where: the symmetry clamp's one-sided list; the brief
- verdict: open — pr body questions 1 and 2
