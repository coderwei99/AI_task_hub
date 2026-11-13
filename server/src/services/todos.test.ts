import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_DATA_DIR = vi.hoisted(() => {
  const dir = `/tmp/ath-todos-${process.pid}-${Date.now()}`;
  process.env.AI_TASK_HUB_DATA_DIR = dir;
  return dir;
});

import { rmSync } from 'node:fs';
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { RequirementStatus } from '@ai-task-hub/shared';
import { db, runMigrations } from '../db';
import { activities, projects, todos } from '../db/schema';
import { patchTodo } from './todos';

beforeAll(() => {
  runMigrations();
});

afterAll(() => {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

function seedTodo(requirementStatus: RequirementStatus, requirementDoc: string): string {
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

const todoOf = (id: string) => db.select().from(todos).where(eq(todos.id, id)).get()!;
const actsOf = (id: string) =>
  db.select().from(activities).where(eq(activities.todoId, id)).orderBy(desc(activities.createdAt)).all();
const payloadOf = (a: { payload: string }) => JSON.parse(a.payload) as Record<string, unknown>;

describe('patchTodo 文档编辑副作用', () => {
  it('编辑文档记录 doc_updated（source=user，prevDoc 为旧全文）', () => {
    const id = seedTodo('ai_ready', '# 旧文档');
    patchTodo(id, { requirementDoc: '# 新文档' });

    expect(todoOf(id).requirementDoc).toBe('# 新文档');
    const docUpdate = actsOf(id).find((a) => a.type === 'doc_updated');
    expect(docUpdate).toBeTruthy();
    expect(payloadOf(docUpdate!)).toMatchObject({ source: 'user', prevDoc: '# 旧文档' });
  });

  it('ai_ready 编辑文档 → 状态不变', () => {
    const id = seedTodo('ai_ready', '# 旧文档');
    patchTodo(id, { requirementDoc: '# 新文档' });
    expect(todoOf(id).requirementStatus).toBe('ai_ready');
    expect(actsOf(id).some((a) => a.type === 'requirement_status_changed')).toBe(false);
  });

  it('polishing 编辑文档 → 状态不变', () => {
    const id = seedTodo('polishing', '# 旧文档');
    patchTodo(id, { requirementDoc: '# 新文档' });
    expect(todoOf(id).requirementStatus).toBe('polishing');
  });

  it('已确认后编辑文档 → reconfirm，并记录 doc_edit 状态流转', () => {
    const id = seedTodo('confirmed', '# 旧文档');
    patchTodo(id, { requirementDoc: '# 新文档' });

    expect(todoOf(id).requirementStatus).toBe('reconfirm');
    const transition = actsOf(id).find(
      (a) => a.type === 'requirement_status_changed' && payloadOf(a).reason === 'doc_edit',
    );
    expect(transition).toBeTruthy();
    expect(payloadOf(transition!)).toMatchObject({ from: 'confirmed', to: 'reconfirm', reason: 'doc_edit' });
  });

  it('回退上一版：用最近 doc_updated 的 prevDoc 恢复文档，并再记录一次 doc_updated', () => {
    const id = seedTodo('ai_ready', '# 版本一');
    patchTodo(id, { requirementDoc: '# 版本二' });

    const latest = actsOf(id).find((a) => a.type === 'doc_updated');
    const prevDoc = payloadOf(latest!).prevDoc as string;
    expect(prevDoc).toBe('# 版本一');

    patchTodo(id, { requirementDoc: prevDoc });
    expect(todoOf(id).requirementDoc).toBe('# 版本一');
    const rollbackUpdate = actsOf(id).find((a) => a.type === 'doc_updated');
    expect(payloadOf(rollbackUpdate!).prevDoc).toBe('# 版本二');
  });

  it('文档内容无变化时不记录 doc_updated', () => {
    const id = seedTodo('ai_ready', '# 文档');
    const before = actsOf(id).filter((a) => a.type === 'doc_updated').length;
    patchTodo(id, { requirementDoc: '# 文档' });
    const after = actsOf(id).filter((a) => a.type === 'doc_updated').length;
    expect(after).toBe(before);
  });
});