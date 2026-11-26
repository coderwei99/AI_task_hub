import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { activities } from '../db/schema';
import { conflict, notFound } from '../lib/errors';
import { activeChats } from './active-chats';
import { getTodoOrThrow, patchTodo } from './todos';

export function documentVersions(todoId: string) {
  const todo = getTodoOrThrow(todoId);
  const changes = db
    .select()
    .from(activities)
    .where(eq(activities.todoId, todoId))
    .orderBy(asc(activities.createdAt), sql`rowid asc`)
    .all()
    .filter((a) => a.type === 'doc_updated');
  return changes.map((change, index) => {
    const payload = JSON.parse(change.payload);
    // Legacy events only stored the previous content. The next event captures
    // this event's result; the newest result is the current document.
    const next = changes[index + 1];
    const document =
      typeof payload.document === 'string'
        ? payload.document
        : next
          ? JSON.parse(next.payload).prevDoc
          : todo.requirementDoc;
    return {
      id: change.id,
      number: index + 1,
      document,
      previousDocument: payload.prevDoc as string,
      createdAt: change.createdAt,
      source: payload.source as string,
      restoredFrom: payload.restoredFrom as number | undefined,
    };
  });
}

export function restoreDocument(todoId: string, versionId: string) {
  return db.transaction(() => {
    if (activeChats.has(todoId)) throw conflict('chatInProgress');
    const version = documentVersions(todoId).find((v) => v.id === versionId);
    if (!version || typeof version.document !== 'string') throw notFound('todoNotFound');
    return patchTodo(todoId, { requirementDoc: version.document }, version.number);
  });
}
