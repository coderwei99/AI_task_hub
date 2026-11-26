import { Hono } from 'hono';
import {
  aiSettingsSchema,
  type AiSettings,
  type AiSettingsInput,
  type AiSettingsSummary,
  type StorageInfo,
} from '@ai-task-hub/shared';
import { testConnection } from '../ai/client';
import { dataDir, dbPath } from '../db';
import { badRequest, requestLocale } from '../lib/errors';
import { parseBody } from '../lib/validate';
import { readSettings, writeSettings } from '../services/settings';

export const settingsRoutes = new Hono();

function summarizeSettings({ baseUrl, model, apiKey }: AiSettings): AiSettingsSummary {
  return { baseUrl, model, hasApiKey: Boolean(apiKey) };
}

function resolveSettings(input: AiSettingsInput): AiSettings {
  const saved = readSettings();
  const sameEndpoint = input.baseUrl.replace(/\/+$/, '') === saved.baseUrl.replace(/\/+$/, '');
  const apiKey = input.apiKey || (sameEndpoint ? saved.apiKey : '');
  if (!apiKey) throw badRequest('aiKeyRequired');
  return { ...input, apiKey };
}

settingsRoutes.get('/', (c) => c.json(summarizeSettings(readSettings())));

settingsRoutes.get('/storage', (c) => c.json<StorageInfo>({ dataDir, dbPath }));

settingsRoutes.put('/', async (c) => {
  const input = resolveSettings(await parseBody(c, aiSettingsSchema));
  writeSettings(input);
  return c.json(summarizeSettings(input));
});

settingsRoutes.post('/test', async (c) => {
  const input = resolveSettings(await parseBody(c, aiSettingsSchema));
  return c.json(await testConnection(input, requestLocale(c)));
});
