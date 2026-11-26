import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { withServer } from './production-server.mjs';

// Resolve the driver's native dependency from the server package.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const Database = require('better-sqlite3');

test('production serves the built UI and can create a project in an empty database', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ath-startup-'));
  try {
    await withServer(dataDir, async (url) => {
      const health = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      assert.equal((await health.json()).ok, true);
      const page = await fetch(`${url}/projects`);
      assert.equal(page.status, 200);
      const asset = (await page.text()).match(/src="([^"]+\.js)"/)?.[1];
      assert.ok(asset);
      const script = await fetch(new URL(asset, url));
      assert.equal(script.status, 200);
      assert.match(script.headers.get('content-type'), /javascript/);
      const created = await fetch(`${url}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Fresh install' }),
      });
      assert.equal(created.status, 201, await created.text());
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('production upgrades a v1 schema and preserves existing projects', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ath-upgrade-'));
  try {
    const sqlite = new Database(join(dataDir, 'data.db'));
    try {
      sqlite.exec(
        readFileSync(
          new URL('../server/src/db/migrations/0000_friendly_talos.sql', import.meta.url),
          'utf8',
        ),
      );
      const journal = JSON.parse(
        readFileSync(
          new URL('../server/src/db/migrations/meta/_journal.json', import.meta.url),
          'utf8',
        ),
      );
      sqlite.exec(
        'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      sqlite
        .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
        .run('legacy', journal.entries[0].when);
      sqlite
        .prepare('INSERT INTO projects (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)')
        .run('legacy-project', 'Legacy project', 1, 1);
    } finally {
      sqlite.close();
    }
    await withServer(dataDir, async (url) => {
      const response = await fetch(`${url}/api/projects/legacy-project`);
      assert.equal(response.status, 200);
      const project = await response.json();
      assert.equal(project.name, 'Legacy project');
      assert.equal(project.color, 'gray');
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
