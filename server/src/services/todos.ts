import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  nextRequirementStatus,
  type CreateTodoInput,
  type Todo,
  type UpdateTodoInput,
} from '@ai-task-hub/shared';
import { db } from '../db';
import { projects, todos } from '../db/schema';
import { notFound } from '../lib/errors';
import { logActivity } from './activities';

export function getTodoOrThrow(id: string): Todo {
  const todo = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!todo) throw notFound('Todo 不存在');
  return todo;
}

export function createTodo(projectId: string, input: CreateTodoInput): Todo {
  return db.transaction((tx) => {
    const project = tx.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) throw notFound('项目不存在');

    const number = project.todoSeq + 1;
    const now = Date.now();
    tx.update(projects).set({ todoSeq: number, updatedAt: now }).where(eq(projects.id, projectId)).run();

    const todo: Todo = {
      id: nanoid(),
      projectId,
      number,
      title: input.title,
      originalDescription: input.originalDescription,
      requirementDoc: '',
      requirementStatus: 'pending',
      executionStatus: 'todo',
      priority: input.priority,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(todos).values(todo).run();
    logActivity(todo.id, 'todo_created', {}, tx);
    return todo;
  });
}

export function patchTodo(id: string, input: UpdateTodoInput): Todo {
  return db.transaction((tx) => {
    const existing = tx.select().from(todos).where(eq(todos.id, id)).get();
    if (!existing) throw notFound('Todo 不存在');

    const updates: Partial<Todo> = { updatedAt: Date.now() };

    if (input.title !== undefined) updates.title = input.title;
    if (input.priority !== undefined) updates.priority = input.priority;

    if (input.executionStatus !== undefined && input.executionStatus !== existing.executionStatus) {
      updates.executionStatus = input.executionStatus;
      logActivity(id, 'execution_status_changed', { from: existing.executionStatus, to: input.executionStatus }, tx);
    }

    if (input.requirementDoc !== undefined && input.requirementDoc !== existing.requirementDoc) {
      updates.requirementDoc = input.requirementDoc;
      logActivity(id, 'doc_updated', { source: 'user', prevDoc: existing.requirementDoc }, tx);
      const nextStatus = nextRequirementStatus(existing.requirementStatus, 'doc_edit');
      if (nextStatus !== existing.requirementStatus) {
        updates.requirementStatus = nextStatus;
        logActivity(
          id,
          'requirement_status_changed',
          { from: existing.requirementStatus, to: nextStatus, reason: 'doc_edit' },
          tx,
        );
      }
    }

    tx.update(todos).set(updates).where(eq(todos.id, id)).run();
    return tx.select().from(todos).where(eq(todos.id, id)).get()!;
  });
}