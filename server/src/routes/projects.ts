import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  createProjectSchema,
  updateProjectSchema,
  type Project,
  type ProjectWithStats,
} from '@ai-task-hub/shared';
import { db } from '../db';
import { projects, todos } from '../db/schema';
import { notFound } from '../lib/errors';
import { parseBody } from '../lib/validate';

export const projectRoutes = new Hono();

function statsFor(projectId: string) {
  const rows = db
    .select({ requirementStatus: todos.requirementStatus })
    .from(todos)
    .where(eq(todos.projectId, projectId))
    .all();
  return {
    total: rows.length,
    pending: rows.filter((r) => r.requirementStatus === 'pending').length,
    confirmed: rows.filter((r) => r.requirementStatus === 'confirmed').length,
  };
}

projectRoutes.get('/', (c) => {
  const list = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  const result: ProjectWithStats[] = list.map((p) => ({ ...p, stats: statsFor(p.id) }));
  return c.json(result);
});

projectRoutes.post('/', async (c) => {
  const input = await parseBody(c, createProjectSchema);
  const now = Date.now();
  const project: Project = { id: nanoid(), ...input, todoSeq: 0, createdAt: now, updatedAt: now };
  db.insert(projects).values(project).run();
  return c.json(project, 201);
});

projectRoutes.get('/:id', (c) => {
  const project = db.select().from(projects).where(eq(projects.id, c.req.param('id'))).get();
  if (!project) throw notFound('项目不存在');
  return c.json({ ...project, stats: statsFor(project.id) });
});

projectRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) throw notFound('项目不存在');
  const input = await parseBody(c, updateProjectSchema);
  db.update(projects).set({ ...input, updatedAt: Date.now() }).where(eq(projects.id, id)).run();
  const project = db.select().from(projects).where(eq(projects.id, id)).get()!;
  return c.json({ ...project, stats: statsFor(project.id) });
});

projectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) throw notFound('项目不存在');
  db.delete(projects).where(eq(projects.id, id)).run();
  return c.json({ ok: true });
});