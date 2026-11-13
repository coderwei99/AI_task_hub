import { Hono } from 'hono';
import { aiSettingsSchema } from '@ai-task-hub/shared';
import { testConnection } from '../ai/client';
import { parseBody } from '../lib/validate';
import { readSettings, writeSettings } from '../services/settings';

export const settingsRoutes = new Hono();

settingsRoutes.get('/', (c) => c.json(readSettings()));

settingsRoutes.put('/', async (c) => {
  const input = await parseBody(c, aiSettingsSchema);
  writeSettings(input);
  return c.json(input);
});

settingsRoutes.post('/test', async (c) => {
  const input = await parseBody(c, aiSettingsSchema);
  return c.json(await testConnection(input));
});