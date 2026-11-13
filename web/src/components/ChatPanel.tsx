import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Send, Settings2, Sparkles, Square } from 'lucide-react';
import { toast } from 'sonner';
import { DOC_DELIMITER, type RequirementStatus, type Todo } from '@ai-task-hub/shared';
import { streamChat } from '@/api/chat';
import { queryKeys, useMessages, useSettings } from '@/api/hooks';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// 流式显示时分隔符可能只到达一半，需把结尾的部分分隔符也裁掉，避免 "===RE" 闪进气泡。
function splitChatStream(text: string): { body: string; docPhase: boolean } {
  const idx = text.indexOf(DOC_DELIMITER);
  if (idx >= 0) return { body: text.slice(0, idx), docPhase: true };
  for (let n = Math.min(DOC_DELIMITER.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(DOC_DELIMITER.slice(0, n))) {
      return { body: text.slice(0, text.length - n), docPhase: false };
    }
  }
  return { body: text, docPhase: false };
}

interface ChatPanelProps {
  todo: Todo;
  onConfirm: () => void;
}

export function ChatPanel({ todo, onConfirm }: ChatPanelProps) {
  const { data: messages } = useMessages(todo.id);
  const { data: settings } = useSettings();
  const qc = useQueryClient();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const configured = settings ? Boolean(settings.baseUrl && settings.apiKey && settings.model) : true;
  const list = messages ?? [];
  const { body: displayText, docPhase } = splitChatStream(streamText);
  const empty = list.length === 0 && !pendingUser && !streaming;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, pendingUser]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function refreshAfterTurn() {
    qc.invalidateQueries({ queryKey: queryKeys.todo(todo.id) });
    qc.invalidateQueries({ queryKey: queryKeys.activities(todo.id) });
    qc.invalidateQueries({ queryKey: ['todos'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['project'] });
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming || !configured) return;
    setInput('');
    setPendingUser(content);
    setStreaming(true);
    setStreamText('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(todo.id, content, {
        signal: controller.signal,
        onDelta: (text) => setStreamText((prev) => prev + text),
        onDone: async (ev) => {
          await qc.invalidateQueries({ queryKey: queryKeys.messages(todo.id) });
          setPendingUser(null);
          setStreamText('');
          setStreaming(false);
          refreshAfterTurn();
          if (ev.parseWarning) toast.warning('本轮需求文档未更新，可重试');
          else if (ev.docRecovered) toast.info('本轮文档已通过补救整理');
        },
        onError: (message) => {
          setStreaming(false);
          setStreamText('');
          setPendingUser(null);
          toast.error(message);
          qc.invalidateQueries({ queryKey: queryKeys.messages(todo.id) });
          refreshAfterTurn();
        },
      });
    } catch (e) {
      setStreaming(false);
      setStreamText('');
      setPendingUser(null);
      if (!controller.signal.aborted) toast.error(e instanceof Error ? e.message : '对话失败');
      qc.invalidateQueries({ queryKey: queryKeys.messages(todo.id) });
      refreshAfterTurn();
    } finally {
      abortRef.current = null;
    }
  }

  const bannerStatus: RequirementStatus = streaming ? 'polishing' : todo.requirementStatus;

  return (
    <div className="flex w-full min-w-0 flex-col md:w-[55%] md:border-r">
      <div className="border-b px-4 py-2 text-sm font-medium">AI 对话</div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>描述你的想法，AI 会帮你澄清并整理成需求文档。</p>
            <p className="text-xs">支持多轮对话，右侧实时生成文档。</p>
          </div>
        ) : (
          <>
            {list.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} />
            ))}
            {pendingUser && <Bubble role="user" content={pendingUser} />}
            {streaming && (
              <Bubble
                role="assistant"
                content={displayText}
                streaming
                tail={docPhase ? '正在整理需求文档…' : undefined}
              />
            )}
          </>
        )}
      </div>

      <StatusBanner status={bannerStatus} streaming={streaming} onConfirm={onConfirm} />

      <div className="border-t p-3">
        {configured ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={streaming}
              placeholder="继续补充需求或回答 AI 的问题…（Enter 发送，Shift+Enter 换行）"
              className="max-h-40 min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            {streaming ? (
              <Button variant="outline" onClick={stop} className="shrink-0">
                <Square /> 停止
              </Button>
            ) : (
              <Button onClick={send} disabled={!input.trim()} className="shrink-0">
                <Send /> 发送
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 text-sm">
            <span className="text-muted-foreground">请先在设置中配置 AI 模型</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings">
                <Settings2 /> 去配置
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  function stop() {
    abortRef.current?.abort();
  }
}

function Bubble({
  role,
  content,
  streaming,
  tail,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  tail?: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <Markdown content={content} className="text-sm" />
        )}
        {tail && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {tail}
          </p>
        )}
        {streaming && !tail && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  streaming,
  onConfirm,
}: {
  status: RequirementStatus;
  streaming: boolean;
  onConfirm: () => void;
}) {
  if (status === 'polishing') {
    return (
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> AI 正在帮你完善需求…
      </div>
    );
  }
  if (status === 'ai_ready' || status === 'reconfirm') {
    return (
      <div className="flex items-center justify-between gap-2 border-t bg-primary/5 px-4 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          {status === 'ai_ready' ? 'AI 认为需求已充分，请查看右侧文档后确认' : '需求已修改，请重新确认'}
        </span>
        <Button size="sm" onClick={onConfirm} disabled={streaming} className="shrink-0">
          <Check /> 确认需求
        </Button>
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <Check className="size-4 text-green-600" /> 需求已确认，可 Copy 交给 Coding Agent
      </div>
    );
  }
  return null;
}