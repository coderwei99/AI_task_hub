import { describe, expect, it } from 'vitest';
import { formatMessage, parseWithLocale, resolveLocale } from './i18n';
import { createProjectSchema, createTodoSchema } from './schemas';

describe('resolveLocale', () => {
  it('缺省时回落中文', () => {
    expect(resolveLocale(undefined)).toBe('zh');
    expect(resolveLocale('')).toBe('zh');
  });

  it('按 Accept-Language 顺序匹配首个支持的语言', () => {
    expect(resolveLocale('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh');
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('ja-JP,zh-TW;q=0.8')).toBe('zh');
  });

  it('均不支持时回落英文', () => {
    expect(resolveLocale('ja-JP,fr;q=0.8')).toBe('en');
  });
});

describe('formatMessage', () => {
  it('替换插值参数', () => {
    expect(formatMessage('en', 'aiTimeout', { seconds: 60 })).toBe('AI response timed out (no data for 60s)');
    expect(formatMessage('zh', 'requestFailed', { status: 502 })).toBe('请求失败 (502)');
  });
});

describe('parseWithLocale', () => {
  it('自定义消息按语言翻译', () => {
    const zh = parseWithLocale(createProjectSchema, { name: ' ' }, 'zh');
    const en = parseWithLocale(createProjectSchema, { name: ' ' }, 'en');
    expect(zh).toEqual({ success: false, message: '项目名称不能为空' });
    expect(en).toEqual({ success: false, message: 'Project name is required' });
  });

  it('未自定义消息的校验使用 zod 内置语言包', () => {
    const r = parseWithLocale(createTodoSchema, { title: 'a', originalDescription: 'b', priority: 'urgent' }, 'zh');
    expect(r.success).toBe(false);
    expect(!r.success && /[\u4e00-\u9fff]/.test(r.message)).toBe(true);
  });

  it('成功时返回解析结果', () => {
    const r = parseWithLocale(createTodoSchema, { title: 'a', originalDescription: 'b' }, 'en');
    expect(r).toEqual({ success: true, data: { title: 'a', originalDescription: 'b', priority: 'medium' } });
  });
});
