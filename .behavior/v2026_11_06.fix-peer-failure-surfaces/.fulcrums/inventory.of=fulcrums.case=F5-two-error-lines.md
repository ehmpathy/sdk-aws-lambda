# F5 — a server fault logs two error lines

- **fork**: (a) io logger logs `handler.output` at error on a server fault, beside the extant `handler.error` · (b) io logger logs server faults at warn, and lets `handler.error` own the error level · (c) drop `handler.error`
- **taken**: (a). the wish states error for "all else", literally; (c) widens scope; (b) contradicts the wish
- **rework**: clean — one level constant
- **confidence 75%, why low**: two error lines per server fault doubles an error-count alarm. the lines differ in name, so a filter on `handler.error` still counts one
- **where**: `genIoLoggerMiddleware.ts` onError
