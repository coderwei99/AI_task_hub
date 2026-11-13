import {
  PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  formatTodoNumber,
  type Project,
  type Todo,
} from './types';

export const SECTION_TITLES = [
  '需求背景',
  '需求目标',
  '功能范围',
  '技术约束',
  '验收标准',
  '排除范围',
  '尚未解决的问题',
] as const;
export type SectionTitle = (typeof SECTION_TITLES)[number];

// AI 输出的标题层级不固定（#/##/### 甚至加粗），导出时统一归一化，故按「核心文本」识别节标题。
function matchSectionTitle(line: string): SectionTitle | null {
  const core = line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/[：:]\s*$/, '')
    .trim();
  return (SECTION_TITLES as readonly string[]).includes(core) ? (core as SectionTitle) : null;
}

export function parseRequirementSections(doc: string): {
  sections: Record<SectionTitle, string>;
  recognized: boolean;
} {
  const buffers = Object.fromEntries(SECTION_TITLES.map((t) => [t, [] as string[]])) as Record<
    SectionTitle,
    string[]
  >;
  let current: SectionTitle | null = null;
  let recognized = false;
  for (const line of doc.split('\n')) {
    const title = matchSectionTitle(line);
    if (title) {
      current = title;
      recognized = true;
      continue;
    }
    if (current) buffers[current].push(line);
  }
  const sections = Object.fromEntries(
    SECTION_TITLES.map((t) => [t, buffers[t].join('\n').trim()]),
  ) as Record<SectionTitle, string>;
  return { sections, recognized };
}

function isEmptySection(content: string): boolean {
  const c = content.trim();
  return c === '' || c === '暂无';
}

function renderSections(doc: string, level: number): string {
  const { sections, recognized } = parseRequirementSections(doc);
  // 用户可能把文档改成非七节结构；无法识别时整段原样保留，避免丢数据。
  if (!recognized) return doc.trim();
  const hashes = '#'.repeat(level);
  const parts: string[] = [];
  for (const title of SECTION_TITLES) {
    if (title === '尚未解决的问题' && isEmptySection(sections[title])) continue;
    parts.push(`${hashes} ${title}\n${sections[title] || '暂无'}`);
  }
  return parts.join('\n\n');
}

function formatExportTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function renderTodoMarkdown(todo: Todo, project: Project, exportedAt: number): string {
  const meta = `> 项目：${project.name} · 优先级：${PRIORITY_LABELS[todo.priority]} · 需求状态：${REQUIREMENT_STATUS_LABELS[todo.requirementStatus]} · 导出时间：${formatExportTime(exportedAt)}`;
  const quote =
    todo.requirementStatus === 'confirmed'
      ? meta
      : `${meta}\n> ⚠ 本需求尚未确认，内容可能继续变化`;

  const contextLines: string[] = [];
  if (project.techStack.trim()) contextLines.push(`- 技术栈：${project.techStack.trim()}`);
  if (project.constraints.trim()) contextLines.push(`- 公共约束：${project.constraints.trim()}`);

  const parts = [`# ${formatTodoNumber(todo.number)} ${todo.title}`, quote];
  if (contextLines.length > 0) parts.push(`## 项目上下文\n${contextLines.join('\n')}`);
  parts.push(renderSections(todo.requirementDoc, 2));
  return `${parts.join('\n\n')}\n`;
}

export function renderProjectMarkdown(
  project: Project,
  confirmedTodos: Todo[],
  exportedAt: number,
): string {
  const tasks = confirmedTodos
    .filter((t) => t.requirementStatus === 'confirmed')
    .sort((a, b) => a.number - b.number);

  const headerParts = [
    `# ${project.name} · 已确认任务集`,
    `> 导出时间：${formatExportTime(exportedAt)} · 已确认任务：${tasks.length} 个\n> 用法：将本文件交给 Coding Agent，按任务编号逐个执行；每个任务独立可验收。`,
  ];
  if (project.description.trim()) headerParts.push(`## 项目背景\n${project.description.trim()}`);
  if (project.techStack.trim()) headerParts.push(`## 技术栈\n${project.techStack.trim()}`);
  if (project.constraints.trim()) headerParts.push(`## 公共约束\n${project.constraints.trim()}`);
  const header = headerParts.join('\n\n');

  // 项目级任务标题为 h2，七节降为 h3 以正确嵌套（内容/规则同 9.1）。
  const blocks = tasks.map(
    (t) => `## ${formatTodoNumber(t.number)} ${t.title}\n\n${renderSections(t.requirementDoc, 3)}`,
  );
  const body = blocks.length > 0 ? `${header}\n\n---\n\n${blocks.join('\n\n---\n\n')}` : header;
  return `${body}\n`;
}