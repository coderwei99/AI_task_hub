import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DATA_DIR = vi.hoisted(() => {
  const dir = `/tmp/ath-chat-${process.pid}-${Date.now()}`;
  process.env.AI_TASK_HUB_DATA_DIR = dir;
  return dir;
});

import { rmSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AiSettings, RequirementStatus } from '@ai-task-hub/shared';
import { DOC_DELIMITER, SUFFICIENT_NO, SUFFICIENT_YES } from '../ai/prompt';
import { db, runMigrations } from '../db';
import { activities, messages, projects, todos } from '../db/schema';
import { runChatTurn } from './chat';

const NORMAL = `我理解了。\n${DOC_DELIMITER}\n# 需求背景\n完整文档\n${SUFFICIENT_YES}`;
const INSUFF = `还需要补充。\n${DOC_DELIMITER}\n# 需求背景\n文档\n${SUFFICIENT_NO}`;
const NO_DOC = '只有对话没有分隔符';

let server: http.Server;
let cfg: AiSettings;
let repairCalls = 0;

beforeAll(async () => {
  runMigrations();
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body) as { stream?: boolean; messages: { role: string; content: string }[] };
      const lastUser = [...parsed.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      if (parsed.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        if (lastUser.includes('STALL')) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '部分回复' }, finish_reason: null }] })}\n\n`);
          const ping = setInterval(() => {
            if (!res.destroyed) res.write(': ping\n\n');
          }, 50);
          req.on('close', () => clearInterval(ping));
          return;
        }
        const text = lastUser.includes('INSUFF')
          ? INSUFF
          : lastUser.includes('NODOC') || lastUser.includes('REPAIRFAIL')
            ? NO_DOC
            : NORMAL;
        const chunks = text.match(/.{1,7}/gs) ?? [];
        let i = 0;
        const timer = setInterval(() => {
          if (i < chunks.length) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i] }, finish_reason: null }] })}\n\n`);
            i += 1;
          } else {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
            res.write('data: [DONE]\n\n');
            clearInterval(timer);
            res.end();
          }
        }, 2);
      } else {
        repairCalls += 1;
        const content = body.includes('REPAIRFAIL') ? '不是 JSON' : JSON.stringify({ document: '# 补救文档', sufficient: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cfg = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, apiKey: 'sk-test', model: 'mock' };
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  repairCalls = 0;
});

function seedTodo(requirementStatus: RequirementStatus = 'pending', requirementDoc = ''): string {
  const now = Date.now();
  const projectId = nanoid();
  db.insert(projects)
    .values({ id: projectId, name: '测试项目', icon: '📁', description: '', techStack: '', constraints: '', todoSeq: 1, createdAt: now, updatedAt: now })
    .run();
  const todoId = nanoid();
  db.insert(todos)
    .values({ id: todoId, projectId, number: 1, title: '测试任务', originalDescription: '原始描述', requirementDoc, requirementStatus, executionStatus: 'todo', priority: 'medium', confirmedAt: null, createdAt: now, updatedAt: now })
    .run();
  return todoId;
}

const idle = () => new AbortController().signal;
const msgsOf = (id: string) => db.select().from(messages).where(eq(messages.todoId, id)).orderBy(asc(messages.createdAt)).all();
const todoOf = (id: string) => db.select().from(todos).where(eq(todos.id, id)).get()!;
const actsOf = (id: string) => db.select().from(activities).where(eq(activities.todoId, id)).all();

describe('runChatTurn', () => {
  it('正常 YES：流式落库 + 文档更新 + polishing→ai_ready', async () => {
    const todoId = seedTodo();
    const deltas: string[] = [];
    const result = await runChatTurn({ todoId, content: '打磨需求', cfg, signal: idle(), onDelta: (t) => { deltas.push(t); } });

    expect(deltas.join('')).toBe(NORMAL);
    expect(result).toMatchObject({ sufficient: true, requirementStatus: 'ai_ready', docUpdated: true, docRecovered: false, parseWarning: false });
    expect(repairCalls).toBe(0);

    const msgs = msgsOf(todoId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('我理解了。');
    expect(msgs[1].id).toBe(result.assistantMessageId);

    const todo = todoOf(todoId);
    expect(todo.requirementDoc).toBe('# 需求背景\n完整文档');
    expect(todo.requirementStatus).toBe('ai_ready');
    expect(actsOf(todoId).some((a) => a.type === 'doc_updated')).toBe(true);
  });

  it('正常 NO：更新文档但状态保持 polishing', async () => {
    const todoId = seedTodo();
    const result = await runChatTurn({ todoId, content: 'INSUFF', cfg, signal: idle(), onDelta: () => {} });
    expect(result.sufficient).toBe(false);
    expect(result.requirementStatus).toBe('polishing');
    expect(result.docUpdated).toBe(true);
    expect(todoOf(todoId).requirementStatus).toBe('polishing');
  });

  it('中断：半截回复不落库，user message 保留，状态 polishing', async () => {
    const todoId = seedTodo();
    const controller = new AbortController();
    let fired = false;
    await expect(
      runChatTurn({
        todoId,
        content: 'STALL',
        cfg,
        signal: controller.signal,
        onDelta: () => {
          if (!fired) {
            fired = true;
            controller.abort();
          }
        },
      }),
    ).rejects.toThrow();

    const msgs = msgsOf(todoId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    const todo = todoOf(todoId);
    expect(todo.requirementStatus).toBe('polishing');
    expect(todo.requirementDoc).toBe('');
  });

  it('缺分隔符 → JSON mode 补救成功（至多一次）', async () => {
    const todoId = seedTodo();
    const result = await runChatTurn({ todoId, content: 'NODOC', cfg, signal: idle(), onDelta: () => {} });
    expect(result.docRecovered).toBe(true);
    expect(result.parseWarning).toBe(false);
    expect(result.requirementStatus).toBe('ai_ready');
    expect(repairCalls).toBe(1);
    expect(todoOf(todoId).requirementDoc).toBe('# 补救文档');
    expect(msgsOf(todoId)[1].content).toBe(NO_DOC);
  });

  it('补救失败 → parseWarning，不更新文档/状态', async () => {
    const todoId = seedTodo();
    const result = await runChatTurn({ todoId, content: 'REPAIRFAIL', cfg, signal: idle(), onDelta: () => {} });
    expect(result).toMatchObject({ parseWarning: true, docRecovered: false, sufficient: null, docUpdated: false, requirementStatus: 'polishing' });
    expect(repairCalls).toBe(1);
    expect(todoOf(todoId).requirementDoc).toBe('');
    expect(msgsOf(todoId)[1].content).toBe(NO_DOC);
  });

  it('已确认 Todo 再次对话 → confirmed→polishing→ai_ready', async () => {
    const todoId = seedTodo('confirmed', '# 旧文档');
    const result = await runChatTurn({ todoId, content: '继续打磨', cfg, signal: idle(), onDelta: () => {} });
    expect(result.requirementStatus).toBe('ai_ready');
    const chatTransition = actsOf(todoId).find(
      (a) => a.type === 'requirement_status_changed' && JSON.parse(a.payload).reason === 'chat',
    );
    expect(chatTransition).toBeTruthy();
    expect(JSON.parse(chatTransition!.payload)).toMatchObject({ from: 'confirmed', to: 'polishing' });
  });
});