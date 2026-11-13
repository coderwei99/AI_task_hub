import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { chatInputSchema } from '@ai-task-hub/shared';
import { badRequest, conflict } from '../lib/errors';
import { parseBody } from '../lib/validate';
import { runChatTurn } from '../services/chat';
import { isAiConfigured, readSettings } from '../services/settings';
import { getTodoOrThrow } from '../services/todos';

export const chatRoutes = new Hono();

const activeChats = new Map<string, AbortController>();

chatRoutes.post('/:id/chat', async (c) => {
  const id = c.req.param('id');
  const input = await parseBody(c, chatInputSchema);
  getTodoOrThrow(id);

  const cfg = readSettings();
  if (!isAiConfigured(cfg)) throw badRequest('请先在设置页配置 AI 服务（Base URL / API Key / 模型）');
  if (activeChats.has(id)) throw conflict('该 Todo 已有进行中的对话，请等待完成或停止后重试');

  const controller = new AbortController();
  activeChats.set(id, controller);
  const onClientAbort = () => controller.abort();
  if (c.req.raw.signal.aborted) controller.abort();
  else c.req.raw.signal.addEventListener('abort', onClientAbort);

  return streamSSE(c, async (stream) => {
    stream.onAbort(onClientAbort);
    try {
      const result = await runChatTurn({
        todoId: id,
        content: input.content,
        cfg,
        signal: controller.signal,
        onDelta: async (text) => {
          await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text }) });
        },
      });
      await stream.writeSSE({ event: 'done', data: JSON.stringify(result) });
    } catch (e) {
      if (!controller.signal.aborted) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: e instanceof Error ? e.message : 'AI 调用失败' }),
        });
      }
    } finally {
      activeChats.delete(id);
      c.req.raw.signal.removeEventListener('abort', onClientAbort);
    }
  });
});