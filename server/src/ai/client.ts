import type { AiSettings } from '@ai-task-hub/shared';
import type { ChatMessage } from './prompt';

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const TEMPERATURE = 0.3;
const MAX_TOKENS = 4096;

function endpoint(cfg: AiSettings): string {
  return `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function headers(cfg: AiSettings): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` };
}

export async function testConnection(cfg: AiSettings): Promise<TestConnectionResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, latencyMs, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, latencyMs };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : '连接失败' };
  }
}

export interface StreamResult {
  text: string;
  finishReason: string | null;
}

export async function streamChatCompletion(
  cfg: AiSettings,
  messages: ChatMessage[],
  opts: { onDelta?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<StreamResult> {
  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 服务返回 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finishReason: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const choice = JSON.parse(payload).choices?.[0];
        const delta = choice?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          full += delta;
          opts.onDelta?.(delta);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        // 忽略非 JSON 的 keep-alive 行
      }
    }
  }

  return { text: full, finishReason };
}

export async function jsonChatCompletion(
  cfg: AiSettings,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 服务返回 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI 未返回有效内容');
  return content;
}