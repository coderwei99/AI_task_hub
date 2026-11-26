import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { withServer } from '../scripts/production-server.mjs';

const original = '原始验收条件';
const updated = '更新后的验收条件';

test('生成、确认、对比与导出需求，模型断流后继续编辑和发送', async ({ page }) => {
  let calls = 0;
  const model = createServer(async (request, response) => {
    request.resume();
    await once(request, 'end');
    const call = ++calls;
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (call === 2) {
      response.flushHeaders();
      response.write('data: {"choices":[{"delta":{"content":"未完成的回复"}}]}\n\n', () => {
        response.destroy();
      });
      return;
    }
    const document =
      call === 1
        ? ['需求背景', '需求目标', '功能范围', '技术约束', '验收标准', '排除范围', '尚未解决的问题']
            .map((title) => `## ${title}\n\n${title === '验收标准' ? `- ${original}` : '暂无'}`)
            .join('\n\n')
        : `===SECTION_UPDATES===\n${JSON.stringify([{ title: '验收标准', body: `- ${updated}` }])}`;
    const content = `已整理。\n===REQUIREMENT_DOC===\n${document}\n===SUFFICIENT: YES===`;
    response.end(
      `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  const dataDir = mkdtempSync(join(tmpdir(), 'ath-browser-'));

  try {
    model.listen(0, '127.0.0.1');
    await once(model, 'listening');
    const address = model.address();
    if (!address || typeof address === 'string') throw new Error('Missing model address');

    await withServer(dataDir, async (url: string) => {
      const settings = await page.request.put(`${url}/api/settings`, {
        data: {
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: 'test-key',
          model: 'test-model',
        },
      });
      expect(settings.ok()).toBe(true);

      await page.goto(url);
      await page.getByRole('button', { name: '创建第一个项目' }).click();
      await page.locator('#project-name').fill('端到端测试项目');
      await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
      await page.getByText('端到端测试项目', { exact: true }).click();
      await page.getByRole('button', { name: '新建第一个 Todo' }).click();
      await page.locator('#todo-title').fill('交付测试需求');
      await page.locator('#todo-desc').fill('验证需求打磨流程');
      await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click();
      await page.getByText('交付测试需求', { exact: true }).click();

      const input = page.getByPlaceholder('继续补充需求', { exact: false });
      const send = page.getByRole('button', { name: '发送', exact: true });
      await input.fill('请整理验收标准');
      await send.click();
      await expect(page.getByText(original, { exact: true })).toBeVisible();

      await input.fill('请补充一条约束');
      await send.click();
      await expect(input).toHaveValue('请补充一条约束');
      await expect(page.getByText(original, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '编辑文档' }).click();
      await expect(page.getByPlaceholder('在此编辑需求文档', { exact: false })).toHaveValue(
        new RegExp(original),
      );
      await page.getByRole('button', { name: '取消', exact: true }).click();
      await send.click();
      await expect(page.getByText(updated, { exact: true })).toBeVisible();

      await page.getByRole('tab', { name: '活动记录' }).click();
      await page
        .getByRole('listitem')
        .filter({ hasText: '· v2' })
        .getByRole('button', { name: '查看版本' })
        .click();
      const history = page.getByRole('dialog', { name: '历史版本 v2' });
      await expect(history.getByRole('columnheader', { name: '上一版' })).toBeVisible();
      await expect(history.getByRole('columnheader', { name: '所选版本' })).toBeVisible();
      await expect(history.getByRole('cell', { name: `−- ${original}` })).toBeVisible();
      await expect(history.getByRole('cell', { name: `+- ${updated}` })).toBeVisible();
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: '确认需求', exact: true }).first().click();
      const confirm = page.getByRole('dialog', { name: '确认需求' });
      await expect(confirm.getByText(updated, { exact: true })).toBeVisible();
      await confirm.getByRole('button', { name: '确认', exact: true }).click();
      await expect(page.getByText('需求已确认，可 Copy 交给 Coding Agent')).toBeVisible();

      await page.getByRole('button', { name: 'Copy', exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toContain(updated);
    });
  } finally {
    const closed = new Promise<void>((resolve) => model.close(() => resolve()));
    model.closeAllConnections();
    await closed;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('导入 Markdown 草稿、下载单条及项目文档，并组合筛选任务', async ({ page }) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ath-markdown-'));
  try {
    await withServer(dataDir, async (url: string) => {
      const projects = await Promise.all(
        ['文档项目', '其他项目'].map(async (name) => {
          const response = await page.request.post(`${url}/api/projects`, { data: { name } });
          expect(response.ok()).toBe(true);
          return response.json();
        }),
      );
      const other = await page.request.post(`${url}/api/projects/${projects[1].id}/todos`, {
        data: { title: '其他任务', originalDescription: '用于验证筛选' },
      });
      expect(other.ok()).toBe(true);

      await page.goto(`${url}/projects/${projects[0].id}`);
      await page.getByRole('button', { name: '新建第一个 Todo' }).click();
      await page.getByLabel('导入 Markdown（可选）').setInputFiles({
        name: '导入需求.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('## 验收标准\n\n- 导入后的验收内容'),
      });
      await expect(page.locator('#todo-title')).toHaveValue('导入需求');
      await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click();
      await expect(page.getByText('导入后的验收内容', { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: '活动记录' }).click();
      await expect(page.getByRole('button', { name: '查看版本' })).toBeVisible();

      await page.goto(`${url}/tasks`);
      await page.getByRole('searchbox').fill('task-001');
      await expect(page.getByRole('row')).toHaveCount(3);
      await page.getByLabel('所属项目', { exact: true }).selectOption({ label: '文档项目' });
      await page.getByLabel('需求状态', { exact: true }).selectOption('pending');
      await page.getByLabel('执行状态', { exact: true }).selectOption('todo');
      await expect(page.getByRole('row')).toHaveCount(2);
      await page.getByRole('searchbox').fill('其他任务');
      await expect(page.getByText('没有匹配的任务。')).toBeVisible();
      await page.getByRole('button', { name: '清除筛选' }).click();
      await expect(page.getByRole('row')).toHaveCount(3);
      await page.getByRole('row').filter({ hasText: '导入需求' }).click();

      await page.getByRole('button', { name: '确认需求', exact: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
      await expect(page.getByText('需求已确认，可 Copy 交给 Coding Agent')).toBeVisible();

      const single = page.waitForEvent('download');
      await page.getByRole('button', { name: '下载 Markdown' }).click();
      expect((await single).suggestedFilename()).toBe('TASK-001 导入需求.md');

      await page.getByRole('link', { name: '文档项目' }).click();
      const project = page.waitForEvent('download');
      await page.getByRole('button', { name: '下载 Markdown' }).click();
      expect((await project).suggestedFilename()).toBe('文档项目.md');
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
