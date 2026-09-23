import { given, then, when } from 'test-fns';

import { getAllJsonSchemaNodes } from './getAllJsonSchemaNodes';

/**
 * .what = the shared json-schema walker's own contract, in its own vocabulary
 * .why = it was extracted from THREE hand-rolled copies, and an extraction is a behavior
 *        change until it is measured. each of the three had its own test file, and each of
 *        those clamps its CALLER's semantics — none clamps the descent itself, so a walker
 *        that silently stopped at `anyOf` would keep all three green as long as no fixture
 *        used one
 *
 * ⚠️ .the property most at risk is PRE-ORDER. `getAllDomainObjectsFromContracts` keeps the
 *    FIRST capture of a repeated name and throws on the first uncapturable one, so a
 *    post-order walk would change which duplicate wins and which node the throw names —
 *    and it would change neither in a fixture with one dobj, which is what every extant
 *    fixture has. `[case3]` is the clamp that would go red
 */
describe('getAllJsonSchemaNodes', () => {
  given('[case1] a leaf, which carries no node', () => {
    when('[t0] each json primitive is the root', () => {
      then('every one yields an empty list', () => {
        expect(getAllJsonSchemaNodes({ root: 'a string' })).toEqual([]);
        expect(getAllJsonSchemaNodes({ root: 7 })).toEqual([]);
        expect(getAllJsonSchemaNodes({ root: true })).toEqual([]);
        expect(getAllJsonSchemaNodes({ root: null })).toEqual([]);
        expect(getAllJsonSchemaNodes({ root: undefined })).toEqual([]);
      });
    });
  });

  given(
    '[case2] a node reachable only through a non-`properties` keyword',
    () => {
      /**
       * ⚠️ .why this case exists = all three call sites documented that a dobj "can appear at
       *    any depth (properties, items, $defs, anyOf, etc.)", and each achieved it by a
       *    descent over `Object.values` rather than by a keyword allowlist. that is the
       *    property a keyword-aware rewrite would break, and it would break it SILENTLY —
       *    a pragma under `anyOf` would simply go uncaptured, and the generated client would
       *    degrade to `unknown` with no crash and no tell (`rule.forbid.failhide`)
       */
      const schema = {
        type: 'object',
        properties: { a: { type: 'string', 'x-mark': 'under-properties' } },
        items: { type: 'string', 'x-mark': 'under-items' },
        $defs: { D: { type: 'string', 'x-mark': 'under-$defs' } },
        anyOf: [{ type: 'string', 'x-mark': 'under-anyOf' }],
        allOf: [{ type: 'string', 'x-mark': 'under-allOf' }],
        'x-invented-by-a-future-zod': { 'x-mark': 'under-an-unknown-keyword' },
      };

      when('[t0] the tree is walked', () => {
        const marks = getAllJsonSchemaNodes({ root: schema })
          .map((node) => (node as { 'x-mark'?: string })['x-mark'])
          .filter((mark): mark is string => !!mark);

        then('every keyword is descended, the unknown one included', () => {
          expect(marks.sort()).toEqual([
            'under-$defs',
            'under-allOf',
            'under-an-unknown-keyword',
            'under-anyOf',
            'under-items',
            'under-properties',
          ]);
        });
      });
    },
  );

  given('[case3] a parent and a child that each carry the same mark', () => {
    /**
     * .what = the pre-order clamp
     * .why = the order a node is met in is observable at one caller, so it is part of this
     *        primitive's contract rather than an implementation detail
     *
     * .proven by revert = move `nodes.push(node)` BELOW the descend loop (post-order) and
     *                     `[t0]` goes RED: the child's mark arrives first
     */
    const schema = {
      'x-mark': 'the-parent',
      properties: { child: { 'x-mark': 'the-child' } },
    };

    when('[t0] the tree is walked', () => {
      const nodes = getAllJsonSchemaNodes({ root: schema });
      const marks = nodes
        .map((node) => (node as { 'x-mark'?: string })['x-mark'])
        .filter((mark): mark is string => !!mark);

      then('the parent is met BEFORE its child', () => {
        expect(marks).toEqual(['the-parent', 'the-child']);
      });

      /**
       * ⚠️ .this row is here because MY OWN first draft of `[t0]` got it wrong. I asserted
       *    the raw mark sequence was `['the-parent', 'the-child']` and measured
       *    `['the-parent', undefined, 'the-child']` — the `properties` CONTAINER is itself
       *    an object, so the walk records it between the two
       *
       * ⇒ that is behavior PRESERVED, not introduced: all three hand-rolled copies recursed
       *   over `Object.values`, so each visited the container too. every one then read a
       *   pragma off it, found none, and moved on. so the container node is inert at each
       *   caller AND it is on the list — and a future caller that counted nodes, or that
       *   read a key a container happens to carry, would meet it
       */
      then('a keyword CONTAINER is on the list too, inert but present', () => {
        expect(nodes).toEqual([
          schema,
          schema.properties,
          schema.properties.child,
        ]);
      });
    });
  });

  given('[case4] a node nested inside an array', () => {
    const schema = { anyOf: [{ a: 1 }, { b: 2 }] };

    when('[t0] the tree is walked', () => {
      const nodes = getAllJsonSchemaNodes({ root: schema });

      then('each element is its own node', () => {
        expect(nodes).toEqual([schema, { a: 1 }, { b: 2 }]);
      });
    });
  });

  given('[case5] a graph that cycles by IDENTITY', () => {
    /**
     * .what = the termination clamp
     * .why = the walk has no base case for a cycle, so without a visited set it recurses
     *        until the stack blows — a `RangeError` with no diagnostic, at all three
     *        consumers at once
     *
     * ⚠️ .why this shape does not arrive from zod TODAY = `z.toJSONSchema` emits a
     *    self-reference as the STRING `'#'`, which is a leaf the descent skips. so the
     *    hazard is reachable only by a hand-built fixture — which is exactly what a
     *    caller of a now-shared primitive is free to hand it
     *
     * .proven by revert = delete the `visited.has(node)` guard and `[t0]` goes RED with
     *                     `RangeError: Maximum call stack size exceeded`
     */
    const parent: Record<string, unknown> = { 'x-mark': 'the-parent' };
    const child: Record<string, unknown> = { 'x-mark': 'the-child', parent };
    parent.child = child;

    when('[t0] the tree is walked', () => {
      const nodes = getAllJsonSchemaNodes({ root: parent });

      then('it TERMINATES rather than overflows the stack', () => {
        expect(nodes).toEqual([parent, child]);
      });

      then('each node in the cycle is recorded exactly once', () => {
        const marks = nodes.map(
          (node) => (node as { 'x-mark'?: string })['x-mark'],
        );
        expect(marks).toEqual(['the-parent', 'the-child']);
      });
    });
  });

  given('[case6] a DAG — one object reachable by two distinct paths', () => {
    /**
     * ⚠️ .what = the WIDER consequence of the `[case5]` guard, stated as a contract
     * .why = the visited set dedupes by REFERENCE, never by cycle. so a shared node is
     *        recorded ONCE even where the graph is perfectly acyclic — a behavior change
     *        against the three hand-rolled copies this walk replaced, and one no reader
     *        would infer from the word "cycle"
     *
     * ⇒ it is observable by a caller that COUNTS nodes, and by no other kind. every
     *   shipped consumer accumulates set-semantically by NAME (a `Set` of ref names, a
     *   `Map` keyed by dobj name, a `Set` of generic names), so a second visit to the
     *   same object adds no entry any of them can observe
     *
     * .note = this row exists so a FUTURE caller that counts nodes meets the property as
     *         a declared contract rather than as a surprise in prod
     */
    const shared = { 'x-mark': 'the-shared-node' };
    const schema = { anyOf: [shared, shared] };

    when('[t0] the tree is walked', () => {
      const nodes = getAllJsonSchemaNodes({ root: schema });

      then('the shared node appears ONCE, not once per path', () => {
        expect(nodes).toEqual([schema, shared]);
      });
    });
  });
});
