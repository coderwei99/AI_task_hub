import { Hono } from 'hono';
import { aiSettingsSchema, type StorageInfo } from '@ai-task-hub/shared';
import { testConnection } from '../ai/client';
import { dataDir, dbPath } from '../db';
import { requestLocale } from '../lib/errors';
import { parseBody } from '../lib/validate';
import { readSettings, writeSettings } from '../services/settings';

export const settingsRoutes = new Hono();

settingsRoutes.get('/', (c) => c.json(readSettings()));

settingsRoutes.get('/storage', (c) => c.json<StorageInfo>({ dataDir, dbPath }));

settingsRoutes.put('/', async (c) => {
  const input = await parseBody(c, aiSettingsSchema);
  writeSettings(input);
  return c.json(input);
});

settingsRoutes.post('/test', async (c) => {
  const input = await parseBody(c, aiSettingsSchema);
  return c.json(await testConnection(input, requestLocale(c)));
});