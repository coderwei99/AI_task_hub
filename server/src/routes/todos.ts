import { asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createTodoSchema, updateTodoSchema } from '@ai-task-hub/shared';
import { db } from '../db';
import { activities, messages, todos } from '../db/schema';
import { parseBody } from '../lib/validate';
import { confirmTodo, createTodo, getTodoOrThrow, patchTodo } from '../services/todos';

export const projectTodoRoutes = new Hono();

projectTodoRoutes.get('/:projectId/todos', (c) => {
  const list = db
    .select()
    .from(todos)
    .where(eq(todos.projectId, c.req.param('projectId')))
    .orderBy(desc(todos.updatedAt))
    .all();
  return c.json(list);
});

projectTodoRoutes.post('/:projectId/todos', async (c) => {
  const input = await parseBody(c, createTodoSchema);
  const todo = createTodo(c.req.param('projectId'), input);
  return c.json(todo, 201);
});

export const todoRoutes = new Hono();

todoRoutes.get('/:id', (c) => c.json(getTodoOrThrow(c.req.param('id'))));

todoRoutes.patch('/:id', async (c) => {
  const input = await parseBody(c, updateTodoSchema);
  return c.json(patchTodo(c.req.param('id'), input));
});

todoRoutes.post('/:id/confirm', (c) => c.json(confirmTodo(c.req.param('id'))));

todoRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  getTodoOrThrow(id);
  db.delete(todos).where(eq(todos.id, id)).run();
  return c.json({ ok: true });
});

todoRoutes.get('/:id/activities', (c) => {
  const id = c.req.param('id');
  getTodoOrThrow(id);
  const list = db
    .select()
    .from(activities)
    .where(eq(activities.todoId, id))
    .orderBy(desc(activities.createdAt))
    .all();
  return c.json(list.map((a) => ({ ...a, payload: JSON.parse(a.payload) as Record<string, unknown> })));
});

todoRoutes.get('/:id/messages', (c) => {
  const id = c.req.param('id');
  getTodoOrThrow(id);
  const list = db
    .select()
    .from(messages)
    .where(eq(messages.todoId, id))
    .orderBy(asc(messages.createdAt))
    .all();
  return c.json(list);
});