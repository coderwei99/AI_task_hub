import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { chatInputSchema } from '@ai-task-hub/shared';
import { badRequest, conflict, localizeError, requestLocale } from '../lib/errors';
import { parseBody } from '../lib/validate';
import { runChatTurn } from '../services/chat';
import { isAiConfigured, readSettings } from '../services/settings';
import { getTodoOrThrow } from '../services/todos';
import { activeChats } from '../services/active-chats';

export const chatRoutes = new Hono();


chatRoutes.post('/:id/chat', async (c) => {
  const id = c.req.param('id');
  const locale = requestLocale(c);
  const input = await parseBody(c, chatInputSchema);
  getTodoOrThrow(id);

  const cfg = readSettings();
  if (!isAiConfigured(cfg)) throw badRequest('aiNotConfigured');
  if (activeChats.has(id)) throw conflict('chatInProgress');

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
          data: JSON.stringify({ message: localizeError(e, locale, 'aiCallFailed') }),
        });
      }
    } finally {
      activeChats.delete(id);
      c.req.raw.signal.removeEventListener('abort', onClientAbort);
    }
  });
});
