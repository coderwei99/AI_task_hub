import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiSettings } from '@ai-task-hub/shared';
import { jsonChatCompletion, streamChatCompletion } from './client';
import { DOC_DELIMITER, SUFFICIENT_YES, type ChatMessage } from './prompt';

const NORMAL_TEXT = `你好，这是对话回复。\n${DOC_DELIMITER}\n# 需求背景\n完整文档内容\n${SUFFICIENT_YES}`;
const TRUNCATED_TEXT = `对话正文\n${DOC_DELIMITER}\n# 需求背景\n被截断的文档`;

let server: http.Server;
let cfg: AiSettings;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body) as { stream?: boolean; messages: ChatMessage[] };
      const lastUser = [...parsed.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      if (parsed.stream) {
        const truncated = lastUser.includes('TRUNCATE');
        const text = truncated ? TRUNCATED_TEXT : NORMAL_TEXT;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const chunks = text.match(/.{1,7}/gs) ?? [];
        let i = 0;
        const timer = setInterval(() => {
          if (i < chunks.length) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i] }, finish_reason: null }] })}\n\n`);
            i += 1;
          } else {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: truncated ? 'length' : 'stop' }] })}\n\n`);
            res.write('data: [DONE]\n\n');
            clearInterval(timer);
            res.end();
          }
        }, 3);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: { role: 'assistant', content: JSON.stringify({ document: '# 需求背景\n补救文档', sufficient: true }) },
                finish_reason: 'stop',
              },
            ],
          }),
        );
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cfg = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, apiKey: 'sk-test', model: 'mock' };
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const messages: ChatMessage[] = [{ role: 'user', content: '打磨需求' }];

describe('streamChatCompletion', () => {
  it('累积全部 delta 并捕获 finish_reason=stop', async () => {
    const deltas: string[] = [];
    const result = await streamChatCompletion(cfg, messages, { onDelta: (t) => deltas.push(t) });
    expect(result.text).toBe(NORMAL_TEXT);
    expect(result.finishReason).toBe('stop');
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe(NORMAL_TEXT);
  });

  it('识别 finish_reason=length（截断）', async () => {
    const result = await streamChatCompletion(cfg, [{ role: 'user', content: 'TRUNCATE' }]);
    expect(result.text).toBe(TRUNCATED_TEXT);
    expect(result.finishReason).toBe('length');
  });

  it('中断信号使调用抛出', async () => {
    await expect(streamChatCompletion(cfg, messages, { signal: AbortSignal.abort() })).rejects.toThrow();
  });
});

describe('jsonChatCompletion', () => {
  it('返回非流式 JSON mode 内容', async () => {
    const content = await jsonChatCompletion(cfg, messages);
    expect(JSON.parse(content)).toEqual({ document: '# 需求背景\n补救文档', sufficient: true });
  });
});