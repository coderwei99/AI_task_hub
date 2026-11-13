import type { Context } from 'hono';
import type { TypeOf, ZodType } from 'zod';
import { badRequest } from './errors';

export async function parseBody<S extends ZodType>(c: Context, schema: S): Promise<TypeOf<S>> {
  const json = await c.req.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? '参数错误');
  }
  return result.data;
}