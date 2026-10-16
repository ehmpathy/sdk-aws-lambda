# foreman verdict — F1 (api-gateway 400 body on a contemp frame)

> 🔴 **superseded.** the human ruled: contemp gets nested, no backcompat. a contemp caller gets the contemp body. the fix is the middleware swap alone, no new option. conditions 3 and 4 below (clamp first; ancient-path snapshots unmoved) still hold. conditions 1 and 2 are void. the lessons: `.agent/repo=.this/role=foreman/briefs/rule.{require.explicit-intent-over-inferred,forbid.inferred-intent-overrides,require.end-state-design,forbid.migration-exceptions}.md`.

## .verdict

keep the guess. the api-gateway family answers the flat body `{ errorMessage, errorType: 'BadRequestError' }`, whatever frame arrived.

## .why — from the surgoal down

- declapract#650 moves every repo's acceptance suite onto `runLambdaEndpoint`. those suites exist to prove what prod does.
- no browser ever receives the nested 400 body. if the sdk answers nested, every suite asserts a shape prod never sends, and 100+ repos inherit that gap. it lowers the floor.
- flat makes the workaround drop a one-line delete. no downstream 400 assertion has to change.
- the 500 path is family-blind (`genInternalServiceErrorMiddleware` has no dialect branch). only the 400 body moves.

## .conditions on the how

1. declare the dialect once, at the family (`forApiGateway`). do not overload `isContempCaller` to mean "answer dialect". it means "the exid arrived in a frame", and the 500 `correlationId` depends on that fact. name the option for the answer dialect, not the caller.
2. `genConstraintErrorMiddleware.test.ts` [case11][t2] asserts apiGateway + contemp -> nested. do not delete it blindly (`rule.require.review-test-changes`).
   - still reachable at the middleware grain: keep it, and add a family-grain test that proves `forApiGateway` answers flat on a contemp frame.
   - unreachable by declaration: rewrite it to state the declared behavior, and give the why in the commit body.
3. clamp first. the case-1 test goes red on 0.7.1 and green after. then revert only the swap, watch it go red, and restore it (`rule.require.clamp-edge-cases`).
4. the prod wire does not move: zero snapshot diffs on the ancient path. any snapshot change on that path is a stop. tell the foreman.

---

@:foreman
