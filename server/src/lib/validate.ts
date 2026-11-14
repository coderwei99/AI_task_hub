import type { Context } from 'hono';
import type { TypeOf, ZodType } from 'zod';
import { parseWithLocale } from '@ai-task-hub/shared';
import { requestLocale, validationError } from './errors';

export async function parseBody<S extends ZodType>(c: Context, schema: S): Promise<TypeOf<S>> {
  const json = await c.req.json().catch(() => null);
  const result = parseWithLocale(schema, json, requestLocale(c));
  if (!result.success) throw validationError(result.message);
  return result.data;
}
