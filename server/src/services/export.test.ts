import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_DATA_DIR = vi.hoisted(() => {
  const dir = `/tmp/ath-export-${process.pid}-${Date.now()}`;
  process.env.AI_TASK_HUB_DATA_DIR = dir;
  return dir;
});

import { rmSync } from 'node:fs';
import { nanoid } from 'nanoid';
import type { RequirementStatus } from '@ai-task-hub/shared';
import { db, runMigrations } from '../db';
import { projects, todos } from '../db/schema';
import { ApiError } from '../lib/errors';
import { exportProjectMarkdown, exportTodoMarkdown } from './export';

beforeAll(() => {
  runMigrations();
});

afterAll(() => {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

const DOC = '## 需求背景\n背景\n## 尚未解决的问题\n暂无';

function seedProject(overrides: { techStack?: string; constraints?: string; description?: string } = {}) {
  const now = Date.now();
  const projectId = nanoid();
  db.insert(projects)
    .values({
      id: projectId,
      name: '测试项目',
      icon: '📁',
      description: overrides.description ?? '',
      techStack: overrides.techStack ?? '',
      constraints: overrides.constraints ?? '',
      todoSeq: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return projectId;
}

function seedTodo(projectId: string, number: number, status: RequirementStatus, title = `任务${number}`) {
  const now = Date.now();
  const todoId = nanoid();
  db.insert(todos)
    .values({
      id: todoId,
      projectId,
      number,
      title,
      originalDescription: '原始描述',
      requirementDoc: DOC,
      requirementStatus: status,
      executionStatus: 'todo',
      priority: 'medium',
      confirmedAt: status === 'confirmed' ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return todoId;
}

function statusOf(fn: () => unknown): number {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return (e as ApiError).status;
  }
  throw new Error('期望抛出 ApiError，但没有');
}

describe('exportTodoMarkdown', () => {
  it('已确认 Todo：含编号标题与项目上下文，无 ⚠ 行，省略空的尚未解决的问题', () => {
    const projectId = seedProject({ techStack: 'Vue 2', constraints: '仅改受影响模块' });
    const id = seedTodo(projectId, 1, 'confirmed', '优化加载');
    const md = exportTodoMarkdown(id);
    expect(md).toContain('# TASK-001 优化加载');
    expect(md).toContain('需求状态：已确认');
    expect(md).toContain('## 项目上下文');
    expect(md).toContain('- 技术栈：Vue 2');
    expect(md).not.toContain('⚠');
    expect(md).not.toContain('## 尚未解决的问题');
  });

  it('未确认 Todo：顶部含 ⚠ 行', () => {
    const projectId = seedProject();
    const id = seedTodo(projectId, 2, 'ai_ready');
    const md = exportTodoMarkdown(id);
    expect(md).toContain('> ⚠ 本需求尚未确认，内容可能继续变化');
    expect(md).not.toContain('## 项目上下文');
  });

  it('不存在的 Todo → 404', () => {
    expect(statusOf(() => exportTodoMarkdown('missing'))).toBe(404);
  });
});

describe('exportProjectMarkdown', () => {
  it('仅导出 confirmed 任务并按编号升序', () => {
    const projectId = seedProject({ description: '项目简介', techStack: 'Vue 2' });
    seedTodo(projectId, 3, 'confirmed', '任务三');
    seedTodo(projectId, 1, 'confirmed', '任务一');
    seedTodo(projectId, 2, 'ai_ready', '任务二');
    const md = exportProjectMarkdown(projectId);
    expect(md).toContain('# 测试项目 · 已确认任务集');
    expect(md).toContain('已确认任务：2 个');
    expect(md).toContain('## 项目背景');
    expect(md).toContain('## TASK-001 任务一');
    expect(md).toContain('## TASK-003 任务三');
    expect(md).not.toContain('任务二');
    expect(md.indexOf('TASK-001')).toBeLessThan(md.indexOf('TASK-003'));
  });

  it('无已确认任务 → 409', () => {
    const projectId = seedProject();
    seedTodo(projectId, 1, 'pending');
    expect(statusOf(() => exportProjectMarkdown(projectId))).toBe(409);
  });

  it('不存在的项目 → 404', () => {
    expect(statusOf(() => exportProjectMarkdown('missing'))).toBe(404);
  });
});