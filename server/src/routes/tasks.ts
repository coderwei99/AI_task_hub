import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { projects, todos } from '../db/schema';

export const taskRoutes = new Hono();

taskRoutes.get('/', (c) => {
  const rows = db.select().from(todos).orderBy(desc(todos.updatedAt)).all();
  const projectList = db.select().from(projects).all();
  const projectMap = new Map(projectList.map((p) => [p.id, p]));
  const result = rows.map((t) => {
    const p = projectMap.get(t.projectId);
    return { ...t, project: p ? { id: p.id, name: p.name, icon: p.icon } : null };
  });
  return c.json(result);
});