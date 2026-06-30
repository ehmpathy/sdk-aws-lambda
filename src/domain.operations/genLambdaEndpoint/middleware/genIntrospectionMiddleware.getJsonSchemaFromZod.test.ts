import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { getJsonSchemaFromZod } from './genIntrospectionMiddleware.getJsonSchemaFromZod';

describe('getJsonSchemaFromZod', () => {
  given('[case1] simple object schema', () => {
    const schema = z.object({
      id: z.string(),
      name: z.string(),
    });

    when('[t0] converted', () => {
      then('returns JSON schema with properties', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.type).toBe('object');
        expect(result.properties).toBeDefined();
        expect((result.properties as Record<string, unknown>).id).toBeDefined();
        expect(
          (result.properties as Record<string, unknown>).name,
        ).toBeDefined();
      });
    });
  });

  given('[case2] schema with optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    when('[t0] converted', () => {
      then('marks required fields correctly', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.required).toContain('required');
        expect(result.required).not.toContain('optional');
      });
    });
  });

  given('[case3] schema with union types', () => {
    const schema = z.union([z.string(), z.number()]);

    when('[t0] converted', () => {
      then('returns anyOf structure', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.anyOf).toBeDefined();
      });
    });
  });

  given('[case4] nested object schema', () => {
    const schema = z.object({
      user: z.object({
        email: z.string(),
      }),
    });

    when('[t0] converted', () => {
      then('preserves nested structure', () => {
        const result = getJsonSchemaFromZod(schema);
        expect(result.type).toBe('object');
        expect(result.properties).toBeDefined();
        const userProp = (result.properties as Record<string, unknown>)
          .user as Record<string, unknown>;
        expect(userProp.type).toBe('object');
      });
    });
  });
});
