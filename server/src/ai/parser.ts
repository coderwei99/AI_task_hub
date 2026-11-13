import type { AiSettings, Message } from '@ai-task-hub/shared';
import { jsonChatCompletion } from './client';
import { DOC_DELIMITER, SUFFICIENT_NO, SUFFICIENT_YES, type ChatMessage } from './prompt';

export type ParseResult =
  | { status: 'ok'; chatBody: string; document: string; sufficient: boolean }
  | { status: 'needs_repair'; chatBody: string; reason: 'missing_delimiter' | 'truncated' };

export function parseAssistantOutput(text: string, finishReason: string | null): ParseResult {
  const docIdx = text.indexOf(DOC_DELIMITER);
  const chatBody = (docIdx >= 0 ? text.slice(0, docIdx) : text).trim();

  if (finishReason === 'length') {
    return { status: 'needs_repair', chatBody, reason: 'truncated' };
  }
  if (docIdx < 0) {
    return { status: 'needs_repair', chatBody, reason: 'missing_delimiter' };
  }

  const afterDoc = text.slice(docIdx + DOC_DELIMITER.length);
  const yesIdx = afterDoc.indexOf(SUFFICIENT_YES);
  const noIdx = afterDoc.indexOf(SUFFICIENT_NO);
  let sufficient: boolean;
  let docEnd: number;
  if (yesIdx >= 0 && (noIdx < 0 || yesIdx < noIdx)) {
    sufficient = true;
    docEnd = yesIdx;
  } else if (noIdx >= 0) {
    sufficient = false;
    docEnd = noIdx;
  } else {
    return { status: 'needs_repair', chatBody, reason: 'missing_delimiter' };
  }

  const document = afterDoc.slice(0, docEnd).trim();
  if (document.length === 0) {
    return { status: 'needs_repair', chatBody, reason: 'missing_delimiter' };
  }
  return { status: 'ok', chatBody, document, sufficient };
}

const REPAIR_SYSTEM_PROMPT = `你是一名需求文档整理助手。下面是一段需求分析对话，其回复可能格式不规范或被截断。
请根据对话内容整理出完整的需求文档，并判断需求是否已充分。

只输出一个 JSON 对象，不要输出任何其他文字、解释或代码块标记：
{"document": "<完整需求文档 Markdown>", "sufficient": <true 或 false>}

document 固定七节：需求背景 / 需求目标 / 功能范围 / 技术约束 / 验收标准 / 排除范围 / 尚未解决的问题；无内容的节写「暂无」，验收标准用 - [ ] 清单。
sufficient 判定：目标明确 / 范围清晰 / 技术约束已知 / 验收可验证 / 边界与排除明确 / 无阻塞性未决问题，全部满足为 true，否则 false。
你无权确认需求，sufficient 仅表示信息是否充分。全程使用中文。`;

export function buildRepairMessages(history: Message[], currentReply: string): ChatMessage[] {
  return [
    { role: 'system', content: REPAIR_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'assistant', content: currentReply },
    { role: 'user', content: '请根据以上完整对话整理需求文档，严格按系统提示输出 JSON 对象。' },
  ];
}

export type RepairParseResult = { ok: true; document: string; sufficient: boolean } | { ok: false };

export function parseRepairJson(content: string): RepairParseResult {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const raw = fence ? fence[1].trim() : trimmed;
  try {
    const obj = JSON.parse(raw) as { document?: unknown; sufficient?: unknown };
    if (typeof obj.document !== 'string' || obj.document.trim().length === 0) return { ok: false };
    if (typeof obj.sufficient !== 'boolean') return { ok: false };
    return { ok: true, document: obj.document, sufficient: obj.sufficient };
  } catch {
    return { ok: false };
  }
}

export interface ResolvedOutput {
  chatBody: string;
  document: string | null;
  sufficient: boolean | null;
  docRecovered: boolean;
  parseWarning: boolean;
}

export async function resolveAssistantOutput(
  cfg: AiSettings,
  history: Message[],
  text: string,
  finishReason: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<ResolvedOutput> {
  const parsed = parseAssistantOutput(text, finishReason);
  if (parsed.status === 'ok') {
    return {
      chatBody: parsed.chatBody,
      document: parsed.document,
      sufficient: parsed.sufficient,
      docRecovered: false,
      parseWarning: false,
    };
  }

  try {
    const content = await jsonChatCompletion(cfg, buildRepairMessages(history, text), { signal: opts.signal });
    const repair = parseRepairJson(content);
    if (repair.ok) {
      return {
        chatBody: parsed.chatBody,
        document: repair.document,
        sufficient: repair.sufficient,
        docRecovered: true,
        parseWarning: false,
      };
    }
  } catch {
    // 补救调用失败（含中断）→ 降级为 parseWarning，是否落库由调用方依据 signal 决定
  }

  return { chatBody: parsed.chatBody, document: null, sufficient: null, docRecovered: false, parseWarning: true };
}