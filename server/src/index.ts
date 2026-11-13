import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbPath, runMigrations } from './db';
import { ApiError } from './lib/errors';
import { chatRoutes } from './routes/chat';
import { projectRoutes } from './routes/projects';
import { settingsRoutes } from './routes/settings';
import { taskRoutes } from './routes/tasks';
import { projectTodoRoutes, todoRoutes } from './routes/todos';

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: 'INTERNAL', message: '服务器内部错误' } }, 500);
});

runMigrations();

app.get('/api/health', (c) => c.json({ ok: true, version: '0.1.0', db: dbPath }));

app.route('/api/projects', projectRoutes);
app.route('/api/projects', projectTodoRoutes);
app.route('/api/todos', todoRoutes);
app.route('/api/todos', chatRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/settings', settingsRoutes);

app.all('/api/*', (c) => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404));

if (process.env.NODE_ENV === 'production') {
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', (c) => c.html(readFileSync(join(webDist, 'index.html'), 'utf-8')));
} else {
  app.get('*', (c) => c.text('AI Task Hub API 已启动。开发模式请访问 http://localhost:5173'));
}

serve({ fetch: app.fetch, port: 8787, hostname: '127.0.0.1' }, (info) => {
  console.log(`AI Task Hub API listening on http://127.0.0.1:${info.port} (db: ${dbPath})`);
});