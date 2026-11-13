import type { AiSettings } from '@ai-task-hub/shared';
import { db } from '../db';
import { settings } from '../db/schema';

const KEYS = { baseUrl: 'ai_base_url', apiKey: 'ai_api_key', model: 'ai_model' } as const;

export function readSettings(): AiSettings {
  const rows = db.select().from(settings).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    baseUrl: map.get(KEYS.baseUrl) ?? '',
    apiKey: map.get(KEYS.apiKey) ?? '',
    model: map.get(KEYS.model) ?? '',
  };
}

export function writeSettings(cfg: AiSettings): void {
  const entries: [string, string][] = [
    [KEYS.baseUrl, cfg.baseUrl],
    [KEYS.apiKey, cfg.apiKey],
    [KEYS.model, cfg.model],
  ];
  db.transaction((tx) => {
    for (const [key, value] of entries) {
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
  });
}

export function isAiConfigured(cfg: AiSettings = readSettings()): boolean {
  return Boolean(cfg.baseUrl && cfg.apiKey && cfg.model);
}