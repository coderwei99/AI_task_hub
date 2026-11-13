import { describe, expect, it } from 'vitest';
import type { Message, Project, Todo } from '@ai-task-hub/shared';
import { DOC_DELIMITER, SUFFICIENT_NO, SUFFICIENT_YES, buildMessages, buildSystemPrompt } from './prompt';

const project: Project = {
  id: 'p1',
  name: '小美客服',
  icon: '💬',
  description: 'Vue2 客服系统',
  techStack: 'Vue 2 + Element UI',
  constraints: '统一组合式 API',
  todoSeq: 1,
  createdAt: 0,
  updatedAt: 0,
};

const todo: Todo = {
  id: 't1',
  projectId: 'p1',
  number: 1,
  title: '优化消息加载速度',
  originalDescription: '会话列表首次加载很慢',
  requirementDoc: '# 需求背景\n已有文档内容',
  requirementStatus: 'polishing',
  executionStatus: 'todo',
  priority: 'high',
  confirmedAt: null,
  createdAt: 0,
  updatedAt: 0,
};

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt(project, todo);

  it('携带项目上下文', () => {
    expect(prompt).toContain('小美客服');
    expect(prompt).toContain('Vue2 客服系统');
    expect(prompt).toContain('Vue 2 + Element UI');
    expect(prompt).toContain('统一组合式 API');
  });

  it('携带任务标题与原始描述', () => {
    expect(prompt).toContain('优化消息加载速度');
    expect(prompt).toContain('会话列表首次加载很慢');
  });

  it('携带当前需求文档', () => {
    expect(prompt).toContain('已有文档内容');
  });

  it('包含 AI 无权确认的硬约束与分隔符', () => {
    expect(prompt).toContain('你无权确认需求');
    expect(prompt).toContain(DOC_DELIMITER);
    expect(prompt).toContain(SUFFICIENT_YES);
    expect(prompt).toContain(SUFFICIENT_NO);
  });

  it('空字段降级为暂无/空', () => {
    const empty = buildSystemPrompt({ ...project, description: '', techStack: '', constraints: '' }, { ...todo, requirementDoc: '' });
    expect(empty).toContain('暂无');
    expect(empty).toContain('（空）');
  });
});

describe('buildMessages', () => {
  const history: Message[] = [
    { id: 'm1', todoId: 't1', role: 'user', content: '第一条', createdAt: 1 },
    { id: 'm2', todoId: 't1', role: 'assistant', content: '回复一', createdAt: 2 },
    { id: 'm3', todoId: 't1', role: 'user', content: '第二条', createdAt: 3 },
  ];

  it('system 在首位，其后按序携带全量历史', () => {
    const msgs = buildMessages(project, todo, history);
    expect(msgs[0].role).toBe('system');
    expect(msgs).toHaveLength(4);
    expect(msgs.slice(1).map((m) => [m.role, m.content])).toEqual([
      ['user', '第一条'],
      ['assistant', '回复一'],
      ['user', '第二条'],
    ]);
  });

  it('无历史时仅含 system', () => {
    const msgs = buildMessages(project, todo, []);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('system');
  });
});