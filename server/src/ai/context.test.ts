import { describe, expect, it } from 'vitest';
import { estimateTokens, selectHistory } from './context';
import type { ChatMessage } from './prompt';
import { buildRepairMessages } from './parser';

const history: ChatMessage[] = [
  { role: 'user', content: '旧问题' },
  { role: 'assistant', content: '旧回复' },
  { role: 'user', content: '新问题' },
  { role: 'assistant', content: '新回复' },
  { role: 'user', content: '当前消息' },
];

describe('context window', () => {
  it('短对话完整保留且不修改原数组', () => {
    expect(selectHistory(history, [])).toEqual(history);
    expect(history).toHaveLength(5);
  });

  it('按完整轮次保留最近对话', () => {
    expect(selectHistory(history, [], { recentTurns: 2 })).toEqual(history.slice(2));
  });

  it('预算包含固定上下文，只保留连续后缀', () => {
    const fixed: ChatMessage = { role: 'system', content: '项目背景' };
    const budget = estimateTokens(fixed) + estimateTokens(history[4]);
    expect(selectHistory(history, [fixed], { inputTokenBudget: budget })).toEqual(history.slice(4));
  });

  it('固定上下文超预算也不丢当前消息', () => {
    expect(selectHistory(history, [], { inputTokenBudget: 0 })).toEqual(history.slice(4));
  });

  it('跳过没有用户消息的孤立回复', () => {
    expect(selectHistory([{ role: 'assistant', content: '孤立' }, ...history], [])).toEqual(history);
    expect(selectHistory([], [])).toEqual([]);
  });

  it('中英文均计入估算', () => {
    expect(estimateTokens({ role: 'user', content: '你好' })).toBe(10);
    expect(estimateTokens({ role: 'user', content: 'hello!' })).toBe(10);
  });

  it('补救调用也裁剪历史并保留文档、本轮回复和整理指令', () => {
    const messages = buildRepairMessages(history.map((m, i) => ({ ...m, role: m.role as 'user' | 'assistant', id: String(i), todoId: 't', createdAt: i })), '本轮回复', { inputTokenBudget: 0, context: '手动编辑文档' });
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toContain('手动编辑文档');
    expect(messages[1].content).toBe('当前消息');
    expect(messages[2].content).toBe('本轮回复');
    expect(messages[3].content).toContain('JSON');
  });
});
