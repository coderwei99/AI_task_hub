import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'ath-settings-'));
  vi.stubEnv('AI_TASK_HUB_DATA_DIR', dataDir);
  const { runMigrations } = await import('../db');
  runMigrations();
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  const { db } = await import('../db');
  db.$client.close();
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

it('keeps the saved key server-side and uses it to test streaming at the saved endpoint', async () => {
  const { settingsRoutes } = await import('./settings');
  const { ApiError } = await import('../lib/errors');
  settingsRoutes.onError((error, c) => {
    if (error instanceof ApiError) return c.json({ code: error.code }, error.status);
    throw error;
  });

  const config = { baseUrl: 'https://example.test/v1', model: 'model-a' };
  const request = (path: string, method: string, body: object) =>
    settingsRoutes.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  expect((await request('/', 'PUT', config)).status).toBe(400);
  const saved = await request('/', 'PUT', { ...config, apiKey: 'test-key' });
  expect(await saved.json()).toEqual({ ...config, hasApiKey: true });
  const updated = { ...config, model: 'model-b' };
  expect((await request('/', 'PUT', { ...updated, apiKey: '' })).status).toBe(200);
  expect(await (await settingsRoutes.request('/')).json()).toEqual({
    ...updated,
    hasApiKey: true,
  });

  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(
          'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        ),
    );
  vi.stubGlobal('fetch', fetchMock);

  const changedEndpoint = { ...updated, baseUrl: 'https://other.test/v1' };
  expect((await request('/test', 'POST', changedEndpoint)).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await (await request('/test', 'POST', updated)).json()).toMatchObject({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.test/v1/chat/completions',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      body: expect.stringContaining('"stream":true'),
    }),
  );

  fetchMock.mockResolvedValueOnce(new Response('data: [DONE]\n\n'));
  expect(await (await request('/test', 'POST', updated)).json()).toMatchObject({ ok: false });
});
