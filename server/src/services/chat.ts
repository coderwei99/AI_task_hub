import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  nextRequirementStatus,
  type AiSettings,
  type ChatDoneEvent,
  type Message,
  type Todo,
} from '@ai-task-hub/shared';
import { streamChatCompletion } from '../ai/client';
import { resolveAssistantOutput } from '../ai/parser';
import { buildMessages } from '../ai/prompt';
import { db } from '../db';
import { messages, projects, todos } from '../db/schema';
import { notFound } from '../lib/errors';
import { logActivity } from './activities';

const UPSTREAM_IDLE_TIMEOUT_MS = 120_000;

export interface ChatTurnOptions {
  todoId: string;
  content: string;
  cfg: AiSettings;
  signal: AbortSignal;
  onDelta: (text: string) => void | Promise<void>;
}

export async function runChatTurn(opts: ChatTurnOptions): Promise<ChatDoneEvent> {
  const { todoId, content, cfg, signal, onDelta } = opts;

  const todo = db.select().from(todos).where(eq(todos.id, todoId)).get();
  if (!todo) throw notFound('Todo 不存在');
  const project = db.select().from(projects).where(eq(projects.id, todo.projectId)).get();
  if (!project) throw notFound('项目不存在');

  const history = db.transaction((tx) => {
    const userMessage: Message = { id: nanoid(), todoId, role: 'user', content, createdAt: Date.now() };
    tx.insert(messages).values(userMessage).run();

    const nextStatus = nextRequirementStatus(todo.requirementStatus, 'user_message');
    if (nextStatus !== todo.requirementStatus) {
      tx.update(todos).set({ requirementStatus: nextStatus, updatedAt: Date.now() }).where(eq(todos.id, todoId)).run();
      logActivity(
        todoId,
        'requirement_status_changed',
        { from: todo.requirementStatus, to: nextStatus, reason: 'chat' },
        tx,
      );
    }
    return tx.select().from(messages).where(eq(messages.todoId, todoId)).orderBy(asc(messages.createdAt)).all();
  });

  const { text, finishReason } = await streamChatCompletion(cfg, buildMessages(project, todo, history), {
    onDelta,
    signal,
    idleTimeoutMs: UPSTREAM_IDLE_TIMEOUT_MS,
  });

  const resolved = await resolveAssistantOutput(cfg, history, text, finishReason, { signal });

  if (signal.aborted) throw new Error('对话已中断');

  return db.transaction((tx) => {
    const assistantMessage: Message = {
      id: nanoid(),
      todoId,
      role: 'assistant',
      content: resolved.chatBody,
      createdAt: Date.now(),
    };
    tx.insert(messages).values(assistantMessage).run();

    const current = tx.select().from(todos).where(eq(todos.id, todoId)).get()!;
    const updates: Partial<Todo> = { updatedAt: Date.now() };
    let docUpdated = false;

    if (resolved.document !== null && resolved.document !== current.requirementDoc) {
      updates.requirementDoc = resolved.document;
      docUpdated = true;
      logActivity(todoId, 'doc_updated', { source: 'ai', prevDoc: current.requirementDoc }, tx);
    }

    let requirementStatus = current.requirementStatus;
    if (resolved.sufficient !== null) {
      const event = resolved.sufficient ? 'ai_sufficient' : 'ai_insufficient';
      const nextStatus = nextRequirementStatus(current.requirementStatus, event);
      if (nextStatus !== current.requirementStatus) {
        updates.requirementStatus = nextStatus;
        requirementStatus = nextStatus;
        logActivity(
          todoId,
          'requirement_status_changed',
          { from: current.requirementStatus, to: nextStatus, reason: event },
          tx,
        );
      }
    }

    tx.update(todos).set(updates).where(eq(todos.id, todoId)).run();

    return {
      assistantMessageId: assistantMessage.id,
      sufficient: resolved.sufficient,
      requirementStatus,
      docUpdated,
      docRecovered: resolved.docRecovered,
      parseWarning: resolved.parseWarning,
    };
  });
}