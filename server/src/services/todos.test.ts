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
import { ApiError } from '../lib/errors';
import { confirmTodo, patchTodo } from './todos';
import { activeChats } from './active-chats';
import { documentVersions, restoreDocument } from './versions';

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
    .values({
      id: projectId,
      name: '测试项目',
      icon: '📁',
      description: '',
      techStack: '',
      constraints: '',
      todoSeq: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const todoId = nanoid();
  db.insert(todos)
    .values({
      id: todoId,
      projectId,
      number: 1,
      title: '测试任务',
      originalDescription: '原始描述',
      requirementDoc,
      requirementStatus,
      executionStatus: 'todo',
      priority: 'medium',
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return todoId;
}

const todoOf = (id: string) => db.select().from(todos).where(eq(todos.id, id)).get()!;
const actsOf = (id: string) =>
  db
    .select()
    .from(activities)
    .where(eq(activities.todoId, id))
    .orderBy(desc(activities.createdAt))
    .all();
const payloadOf = (a: { payload: string }) => JSON.parse(a.payload) as Record<string, unknown>;

describe('文档历史版本', () => {
  it('A→B→C 可恢复 A 再恢复 C，保留全部版本且不影响执行状态', () => {
    const id = seedTodo('polishing', '');
    patchTodo(id, { requirementDoc: 'A' });
    patchTodo(id, { requirementDoc: 'B' });
    patchTodo(id, { requirementDoc: 'C' });
    const versions = documentVersions(id);
    expect(versions.map((v) => v.document)).toEqual(['A', 'B', 'C']);
    confirmTodo(id);
    expect(restoreDocument(id, versions[0].id).requirementStatus).toBe('reconfirm');
    expect(documentVersions(id).map((v) => v.document)).toEqual(['A', 'B', 'C', 'A']);
    restoreDocument(id, versions[2].id);
    expect(todoOf(id).requirementDoc).toBe('C');
    expect(todoOf(id).executionStatus).toBe('todo');
    expect(documentVersions(id)).toHaveLength(5);
    restoreDocument(id, versions[2].id);
    expect(documentVersions(id)).toHaveLength(5);
  });

  it('生成期间及其他任务的版本不能恢复', () => {
    const id = seedTodo('polishing', '');
    patchTodo(id, { requirementDoc: 'A' });
    const version = documentVersions(id)[0];
    activeChats.set(id, new AbortController());
    try {
      expect(() => restoreDocument(id, version.id)).toThrow(ApiError);
    } finally {
      activeChats.delete(id);
    }
    const other = seedTodo('pending', '');
    expect(() => restoreDocument(other, version.id)).toThrow(ApiError);
  });
});

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
    expect(payloadOf(transition!)).toMatchObject({
      from: 'confirmed',
      to: 'reconfirm',
      reason: 'doc_edit',
    });
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

describe('confirmTodo 确认门控', () => {
  it('ai_ready 确认 → confirmed，写 confirmedAt 与 confirmed/user_confirm 活动', () => {
    const id = seedTodo('ai_ready', '# 文档');
    const before = Date.now();
    const result = confirmTodo(id);

    expect(result.requirementStatus).toBe('confirmed');
    expect(result.confirmedAt).toBeGreaterThanOrEqual(before);
    const acts = actsOf(id);
    expect(acts.some((a) => a.type === 'confirmed')).toBe(true);
    const transition = acts.find(
      (a) => a.type === 'requirement_status_changed' && payloadOf(a).reason === 'user_confirm',
    );
    expect(payloadOf(transition!)).toMatchObject({
      from: 'ai_ready',
      to: 'confirmed',
      reason: 'user_confirm',
    });
  });

  it('reconfirm 确认 → confirmed', () => {
    const id = seedTodo('reconfirm', '# 文档');
    expect(confirmTodo(id).requirementStatus).toBe('confirmed');
  });

  it('pending/polishing 有文档时允许用户确认', () => {
    for (const status of ['pending', 'polishing'] as RequirementStatus[]) {
      expect(confirmTodo(seedTodo(status, '# 文档')).requirementStatus).toBe('confirmed');
    }
  });

  it('生成期间拒绝确认，结束后可确认', () => {
    const id = seedTodo('polishing', '# 文档');
    activeChats.set(id, new AbortController());
    try {
      expect(() => confirmTodo(id)).toThrow(ApiError);
      expect(todoOf(id).requirementStatus).toBe('polishing');
    } finally {
      activeChats.delete(id);
    }
    expect(confirmTodo(id).requirementStatus).toBe('confirmed');
  });

  it('所有状态的空白文档都不允许确认', () => {
    for (const status of ['pending', 'polishing', 'ai_ready', 'reconfirm'] as RequirementStatus[]) {
      expect(() => confirmTodo(seedTodo(status, '  \n '))).toThrow(ApiError);
    }
  });

  it('confirmed 重复确认 → 409，状态不变', () => {
    for (const status of ['confirmed'] as RequirementStatus[]) {
      const id = seedTodo(status, '# 文档');
      let err: unknown;
      try {
        confirmTodo(id);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(409);
      expect(todoOf(id).requirementStatus).toBe(status);
    }
  });

  it('不存在的 Todo 确认 → 404', () => {
    let err: unknown;
    try {
      confirmTodo('missing-id');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });
});
