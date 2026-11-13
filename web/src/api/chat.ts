import type { ApiErrorBody, ChatDoneEvent } from '@ai-task-hub/shared';

export interface ChatStreamHandlers {
  onDelta: (text: string) => void;
  onDone: (event: ChatDoneEvent) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(todoId: string, content: string, h: ChatStreamHandlers): Promise<void> {
  const res = await fetch(`/api/todos/${todoId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: h.signal,
  });

  if (!res.ok || !res.body) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = (await res.json()) as ApiErrorBody;
      if (data.error) message = data.error.message;
    } catch {}
    h.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventType = '';
      return;
    }
    const data = dataLines.join('\n');
    const type = eventType || 'message';
    dataLines = [];
    eventType = '';
    try {
      if (type === 'delta') h.onDelta((JSON.parse(data) as { text: string }).text);
      else if (type === 'done') h.onDone(JSON.parse(data) as ChatDoneEvent);
      else if (type === 'error') h.onError((JSON.parse(data) as { message: string }).message);
    } catch {
      // 忽略无法解析的事件
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
      if (line === '') {
        dispatch();
        continue;
      }
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
  }
  dispatch();
}