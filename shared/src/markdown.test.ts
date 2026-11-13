import { describe, expect, it } from 'vitest';
import {
  parseRequirementSections,
  renderProjectMarkdown,
  renderTodoMarkdown,
} from './markdown';
import type { Project, Todo } from './types';

// 用本地时间构造时间戳，formatExportTime 以本地 getter 读回 → 任意 TZ 下都得到 2026-11-13 15:00。
const EXPORTED_AT = new Date(2026, 10, 13, 15, 0).getTime();

const SEVEN_SECTION_DOC = `# 需求背景
优化消息加载速度，提升首屏体验。

## 需求目标
首屏可交互时间 < 500ms。

### 功能范围
消息列表虚拟滚动。

## 技术约束
Vue 2 + Element UI。

## 验收标准
- [ ] 首屏 < 500ms（本地 1000 条消息）

## 排除范围
不做后端分页改造。

## 尚未解决的问题
暂无`;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: '小美客服',
    icon: '📁',
    description: '客服工作台',
    techStack: 'Vue 2 + Element UI（管理端）/ uni-app（移动端）',
    constraints: '仅修改受影响模块；i18n 只改源文件后重新构建',
    todoSeq: 3,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    projectId: 'p1',
    number: 1,
    title: '优化消息加载速度',
    originalDescription: '消息加载太慢',
    requirementDoc: SEVEN_SECTION_DOC,
    requirementStatus: 'confirmed',
    executionStatus: 'todo',
    priority: 'high',
    confirmedAt: EXPORTED_AT,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('renderTodoMarkdown', () => {
  it('已确认 Todo 全量输出（含项目上下文，无 ⚠ 行，标题归一化为 h2）', () => {
    const md = renderTodoMarkdown(makeTodo(), makeProject(), EXPORTED_AT);
    expect(md).toMatchSnapshot();
    expect(md).toContain('# TASK-001 优化消息加载速度');
    expect(md).toContain('> 项目：小美客服 · 优先级：高 · 需求状态：已确认 · 导出时间：2026-11-13 15:00');
    expect(md).not.toContain('⚠');
    expect(md).toContain('## 项目上下文');
    expect(md).toContain('## 需求背景');
    expect(md).toContain('## 功能范围');
    expect(md).not.toContain('### ');
  });

  it('未确认 Todo 顶部加 ⚠ 行', () => {
    const md = renderTodoMarkdown(makeTodo({ requirementStatus: 'ai_ready' }), makeProject(), EXPORTED_AT);
    expect(md).toMatchSnapshot();
    expect(md).toContain('> ⚠ 本需求尚未确认，内容可能继续变化');
    expect(md).toContain('需求状态：AI 已完成分析');
  });

  it('技术栈与约束都为空 → 省略项目上下文整节', () => {
    const md = renderTodoMarkdown(
      makeTodo(),
      makeProject({ techStack: '', constraints: '   ' }),
      EXPORTED_AT,
    );
    expect(md).not.toContain('## 项目上下文');
    expect(md).not.toContain('- 技术栈：');
    expect(md).not.toContain('- 公共约束：');
  });

  it('仅有技术栈 → 项目上下文只输出技术栈行', () => {
    const md = renderTodoMarkdown(makeTodo(), makeProject({ constraints: '' }), EXPORTED_AT);
    expect(md).toContain('## 项目上下文');
    expect(md).toContain('- 技术栈：Vue 2 + Element UI（管理端）/ uni-app（移动端）');
    expect(md).not.toContain('- 公共约束：');
  });

  it('尚未解决的问题为「暂无」→ 省略整节；有内容则保留', () => {
    const omitted = renderTodoMarkdown(makeTodo(), makeProject(), EXPORTED_AT);
    expect(omitted).not.toContain('## 尚未解决的问题');

    const withOpen = SEVEN_SECTION_DOC.replace('## 尚未解决的问题\n暂无', '## 尚未解决的问题\n- 是否需要兼容 IE？');
    const kept = renderTodoMarkdown(makeTodo({ requirementDoc: withOpen }), makeProject(), EXPORTED_AT);
    expect(kept).toContain('## 尚未解决的问题');
    expect(kept).toContain('- 是否需要兼容 IE？');
  });

  it('文档非七节结构 → 原样保留，避免丢数据', () => {
    const freeform = '这是一段用户自由编辑的说明，没有任何标准节标题。';
    const md = renderTodoMarkdown(makeTodo({ requirementDoc: freeform }), makeProject(), EXPORTED_AT);
    expect(md).toContain(freeform);
    expect(md).not.toContain('## 需求背景');
  });
});

describe('renderProjectMarkdown', () => {
  it('仅导出 confirmed 任务，按编号升序，七节降为 h3，--- 分隔', () => {
    const todos = [
      makeTodo({ id: 't3', number: 3, title: '会话转接' }),
      makeTodo({ id: 't2', number: 2, title: '未确认任务', requirementStatus: 'ai_ready' }),
      makeTodo({ id: 't1', number: 1, title: '优化消息加载速度' }),
    ];
    const md = renderProjectMarkdown(makeProject(), todos, EXPORTED_AT);
    expect(md).toMatchSnapshot();
    expect(md).toContain('# 小美客服 · 已确认任务集');
    expect(md).toContain('> 导出时间：2026-11-13 15:00 · 已确认任务：2 个');
    expect(md).toContain('> 用法：将本文件交给 Coding Agent，按任务编号逐个执行；每个任务独立可验收。');
    expect(md).not.toContain('未确认任务');
    expect(md.indexOf('## TASK-001')).toBeLessThan(md.indexOf('## TASK-003'));
    expect(md).toContain('### 需求背景');
    expect(md).not.toContain('\n## 需求背景');
    expect(md).toContain('\n\n---\n\n');
    expect(md).not.toContain('## 项目上下文');
  });

  it('项目背景/技术栈/约束为空 → 对应节省略', () => {
    const md = renderProjectMarkdown(
      makeProject({ description: '', techStack: '', constraints: '' }),
      [makeTodo()],
      EXPORTED_AT,
    );
    expect(md).not.toContain('## 项目背景');
    expect(md).not.toContain('## 技术栈');
    expect(md).not.toContain('## 公共约束');
    expect(md).toContain('## TASK-001');
  });

  it('无已确认任务 → 仅头部，计数 0', () => {
    const md = renderProjectMarkdown(makeProject(), [makeTodo({ requirementStatus: 'pending' })], EXPORTED_AT);
    expect(md).toContain('已确认任务：0 个');
    expect(md).not.toContain('## TASK-');
    expect(md).not.toContain('---');
  });
});

describe('parseRequirementSections', () => {
  it('识别混合层级标题并归一化内容', () => {
    const { sections, recognized } = parseRequirementSections(SEVEN_SECTION_DOC);
    expect(recognized).toBe(true);
    expect(sections['需求背景']).toBe('优化消息加载速度，提升首屏体验。');
    expect(sections['功能范围']).toBe('消息列表虚拟滚动。');
    expect(sections['尚未解决的问题']).toBe('暂无');
  });

  it('无标准节标题 → recognized=false', () => {
    const { recognized } = parseRequirementSections('随便写的一段话');
    expect(recognized).toBe(false);
  });

  it('忽略正文中形似标题的行（带前缀/后缀）', () => {
    const doc = '## 需求背景\n- 需求背景：这是正文不是标题\n## 需求目标\n略';
    const { sections } = parseRequirementSections(doc);
    expect(sections['需求背景']).toBe('- 需求背景：这是正文不是标题');
    expect(sections['需求目标']).toBe('略');
  });
});