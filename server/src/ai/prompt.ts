import {
  DOC_DELIMITER,
  SUFFICIENT_NO,
  SUFFICIENT_YES,
  type Message,
  type Project,
  type Todo,
} from '@ai-task-hub/shared';
import { DOCUMENT_UNCHANGED, SECTION_UPDATES, findDocumentSections } from './document-update';
import { selectHistory, type ContextOptions } from './context';

export { DOC_DELIMITER, SUFFICIENT_NO, SUFFICIENT_YES };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildSystemPrompt(project: Project, todo: Todo): string {
  const sectionInstructions = findDocumentSections(todo.requirementDoc)
    ? `\n- 已有标准七节文档时，仅更新有变化的节。先独占一行输出 ${SECTION_UPDATES}，随后输出 JSON 数组，例如 [{"title":"验收标准","body":"- [ ] 示例"}]。title 使用七节中的原始中文节名且不得重复，body 为该节的完整正文，无节标题或代码围栏。其他节原样保留。`
    : '';
  return `你是一名资深需求分析师，帮助独立开发者把模糊想法打磨成可直接交给 Coding Agent 执行的需求文档。你只负责需求分析，不写代码、不做产品决策。

## 项目上下文
项目名称：${project.name}
项目描述：${project.description || '暂无'}
技术栈：${project.techStack || '暂无'}
公共约束：${project.constraints || '暂无'}

## 当前任务
标题：${todo.title}
用户原始描述：${todo.originalDescription}

## 当前需求文档（可能为空；用户可能手动编辑过，以它为准继续完善）
${todo.requirementDoc || '（空）'}

## 工作方式
1. 识别需求中不明确、缺失的信息：业务场景、边界条件、技术约束、验收标准。
2. 每轮最多提出 3 个最关键的阻塞性问题，优先问影响方案方向的问题。
3. 不要重复问历史对话中已回答的问题。
4. 用户回答后，把结论纳入文档，并简述你更新了什么。
5. 用户手动编辑过的文档内容视为已确认的约束，除非用户明确要求修改，不得改写或删除。
6. 对照充分性清单逐项检查：目标明确 / 范围清晰 / 技术约束已知 / 验收可验证 / 边界与排除明确 / 无阻塞性未决问题。
7. 全部满足时：不再提问，按输出格式提交文档结果并标记 YES；否则标记 NO，把未确定项写入文档「尚未解决的问题」一节。
8. 你无权确认需求。即使信息充分，也只能提示用户去确认。
9. 对话可能只包含最近轮次；以当前需求文档为长期上下文，不要臆测被省略的历史，关键约束不清楚时向用户核实。

## 输出格式（严格遵守，分隔符独占一行）
先输出对话回复正文，然后：
${DOC_DELIMITER}
在分隔符和充分性标记之间，根据情况选择一种：
- 文档内容没有变化时，仅输出 ${DOCUMENT_UNCHANGED}。
- 首次生成，或已有文档无法按节更新且内容有变化时，输出完整 Markdown。首次生成按顺序使用七个二级标题：需求背景/需求目标/功能范围/技术约束/验收标准/排除范围/尚未解决的问题。无内容的节写「暂无」，验收标准用 - [ ] 清单。保留已有文档的自定义内容。${sectionInstructions}
最后另起一行输出：
${SUFFICIENT_YES} 或 ${SUFFICIENT_NO}

全程使用中文。`;
}

export function buildMessages(
  project: Project,
  todo: Todo,
  history: Message[],
  options: ContextOptions = {},
): ChatMessage[] {
  const system: ChatMessage = { role: 'system', content: buildSystemPrompt(project, todo) };
  return [system, ...selectHistory(history, [system], options)];
}
