import { eq } from 'drizzle-orm';
import { renderProjectMarkdown, renderTodoMarkdown } from '@ai-task-hub/shared';
import { db } from '../db';
import { projects, todos } from '../db/schema';
import { conflict, notFound } from '../lib/errors';
import { getTodoOrThrow } from './todos';

export function exportTodoMarkdown(id: string): string {
  const todo = getTodoOrThrow(id);
  const project = db.select().from(projects).where(eq(projects.id, todo.projectId)).get();
  if (!project) throw notFound('项目不存在');
  return renderTodoMarkdown(todo, project, Date.now());
}

export function exportProjectMarkdown(id: string): string {
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw notFound('项目不存在');
  const confirmed = db
    .select()
    .from(todos)
    .where(eq(todos.projectId, id))
    .all()
    .filter((t) => t.requirementStatus === 'confirmed');
  if (confirmed.length === 0) throw conflict('暂无已确认任务');
  return renderProjectMarkdown(project, confirmed, Date.now());
}