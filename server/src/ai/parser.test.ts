import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiSettings, Message } from '@ai-task-hub/shared';
import { buildRepairMessages, parseAssistantOutput, parseRepairJson, resolveAssistantOutput } from './parser';
import { DOC_DELIMITER, SUFFICIENT_NO, SUFFICIENT_YES } from './prompt';

const DOC = '# 需求背景\n这是完整文档\n## 需求目标\n暂无';
const NORMAL = `好的，我理解了你的需求。\n${DOC_DELIMITER}\n${DOC}\n${SUFFICIENT_YES}`;

function msg(role: 'user' | 'assistant', content: string): Message {
  return { id: 'm', todoId: 't', role, content, createdAt: 0 };
}

describe('parseAssistantOutput', () => {
  it('正常三段（YES）拆分正文/文档/充分性', () => {
    const r = parseAssistantOutput(NORMAL, 'stop');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.chatBody).toBe('好的，我理解了你的需求。');
      expect(r.document).toBe(DOC);
      expect(r.sufficient).toBe(true);
    }
  });

  it('正常三段（NO）', () => {
    const r = parseAssistantOutput(`正文\n${DOC_DELIMITER}\n${DOC}\n${SUFFICIENT_NO}`, 'stop');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.sufficient).toBe(false);
  });

  it('缺文档分隔符 → 需补救，整段视为正文', () => {
    const r = parseAssistantOutput('只有对话没有文档', 'stop');
    expect(r.status).toBe('needs_repair');
    if (r.status === 'needs_repair') {
      expect(r.reason).toBe('missing_delimiter');
      expect(r.chatBody).toBe('只有对话没有文档');
    }
  });

  it('缺充分性标记 → 需补救，正文取分隔符前', () => {
    const r = parseAssistantOutput(`正文\n${DOC_DELIMITER}\n${DOC}`, 'stop');
    expect(r.status).toBe('needs_repair');
    if (r.status === 'needs_repair') {
      expect(r.reason).toBe('missing_delimiter');
      expect(r.chatBody).toBe('正文');
    }
  });

  it('文档为空 → 需补救', () => {
    const r = parseAssistantOutput(`正文\n${DOC_DELIMITER}\n\n${SUFFICIENT_YES}`, 'stop');
    expect(r.status).toBe('needs_repair');
  });

  it('finish_reason=length 即使三段齐全也判截断', () => {
    const r = parseAssistantOutput(NORMAL, 'length');
    expect(r.status).toBe('needs_repair');
    if (r.status === 'needs_repair') expect(r.reason).toBe('truncated');
  });

  it('finish_reason=null 不影响正常解析', () => {
    expect(parseAssistantOutput(NORMAL, null).status).toBe('ok');
  });
});

describe('parseRepairJson', () => {
  it('合法 JSON', () => {
    expect(parseRepairJson(JSON.stringify({ document: DOC, sufficient: true }))).toEqual({
      ok: true,
      document: DOC,
      sufficient: true,
    });
  });

  it('代码块包裹的 JSON 也能解析', () => {
    const wrapped = '```json\n' + JSON.stringify({ document: DOC, sufficient: false }) + '\n```';
    expect(parseRepairJson(wrapped)).toEqual({ ok: true, document: DOC, sufficient: false });
  });

  it('非法 JSON → ok:false', () => {
    expect(parseRepairJson('这不是 JSON').ok).toBe(false);
  });

  it('缺字段 → ok:false', () => {
    expect(parseRepairJson(JSON.stringify({ document: DOC })).ok).toBe(false);
    expect(parseRepairJson(JSON.stringify({ sufficient: true })).ok).toBe(false);
  });

  it('字段类型错误 → ok:false', () => {
    expect(parseRepairJson(JSON.stringify({ document: 123, sufficient: true })).ok).toBe(false);
    expect(parseRepairJson(JSON.stringify({ document: DOC, sufficient: 'yes' })).ok).toBe(false);
  });

  it('空文档 → ok:false', () => {
    expect(parseRepairJson(JSON.stringify({ document: '   ', sufficient: true })).ok).toBe(false);
  });
});

describe('buildRepairMessages', () => {
  it('system 优先 + 历史 + 本轮回复 + 整理指令', () => {
    const history = [msg('user', '想法'), msg('assistant', '问题')];
    const m = buildRepairMessages(history, '本轮回复');
    expect(m[0].role).toBe('system');
    expect(m[0].content).toContain('JSON');
    expect(m[1]).toEqual({ role: 'user', content: '想法' });
    expect(m[2]).toEqual({ role: 'assistant', content: '问题' });
    expect(m[3]).toEqual({ role: 'assistant', content: '本轮回复' });
    expect(m[4].role).toBe('user');
  });
});

let server: http.Server;
let cfg: AiSettings;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const fail = body.includes('REPAIR_FAIL');
      const content = fail ? '抱歉我无法输出 JSON' : JSON.stringify({ document: '# 补救文档', sufficient: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cfg = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, apiKey: 'sk-test', model: 'mock' };
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('resolveAssistantOutput', () => {
  const history = [msg('user', '打磨需求')];

  it('正常输出不触发补救', async () => {
    const r = await resolveAssistantOutput(cfg, history, NORMAL, 'stop');
    expect(r.docRecovered).toBe(false);
    expect(r.parseWarning).toBe(false);
    expect(r.document).toBe(DOC);
    expect(r.sufficient).toBe(true);
  });

  it('缺分隔符 → 补救成功，docRecovered=true', async () => {
    const r = await resolveAssistantOutput(cfg, history, '只有对话', 'stop');
    expect(r.docRecovered).toBe(true);
    expect(r.parseWarning).toBe(false);
    expect(r.document).toBe('# 补救文档');
    expect(r.sufficient).toBe(true);
    expect(r.chatBody).toBe('只有对话');
  });

  it('截断 → 补救成功', async () => {
    const r = await resolveAssistantOutput(cfg, history, NORMAL, 'length');
    expect(r.docRecovered).toBe(true);
    expect(r.document).toBe('# 补救文档');
  });

  it('补救失败 → parseWarning，不更新文档/状态', async () => {
    const r = await resolveAssistantOutput(cfg, history, 'REPAIR_FAIL 只有对话', 'stop');
    expect(r.parseWarning).toBe(true);
    expect(r.docRecovered).toBe(false);
    expect(r.document).toBeNull();
    expect(r.sufficient).toBeNull();
    expect(r.chatBody).toBe('REPAIR_FAIL 只有对话');
  });
});