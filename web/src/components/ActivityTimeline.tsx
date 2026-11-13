import { ArrowRight, CheckCircle2, FilePlus2, FileText, RefreshCw } from 'lucide-react';
import {
  EXECUTION_STATUS_LABELS,
  REQUIREMENT_STATUS_LABELS,
  type Activity,
  type ExecutionStatus,
  type RequirementStatus,
} from '@ai-task-hub/shared';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<string, string> = {
  chat: '对话',
  ai_sufficient: 'AI 判定充分',
  user_confirm: '用户确认',
  doc_edit: '文档编辑',
};

function describe(a: Activity): { icon: React.ReactNode; text: string; highlight?: boolean } {
  const p = a.payload;
  switch (a.type) {
    case 'todo_created':
      return { icon: <FilePlus2 className="size-4" />, text: '创建了 Todo' };
    case 'requirement_status_changed': {
      const from = REQUIREMENT_STATUS_LABELS[p.from as RequirementStatus] ?? String(p.from);
      const to = REQUIREMENT_STATUS_LABELS[p.to as RequirementStatus] ?? String(p.to);
      const reason = p.reason ? `（${REASON_LABELS[String(p.reason)] ?? String(p.reason)}）` : '';
      return { icon: <RefreshCw className="size-4" />, text: `需求状态：${from} → ${to}${reason}` };
    }
    case 'execution_status_changed': {
      const from = EXECUTION_STATUS_LABELS[p.from as ExecutionStatus] ?? String(p.from);
      const to = EXECUTION_STATUS_LABELS[p.to as ExecutionStatus] ?? String(p.to);
      return { icon: <ArrowRight className="size-4" />, text: `执行状态：${from} → ${to}` };
    }
    case 'doc_updated': {
      const source = p.source === 'ai' ? 'AI' : '用户';
      return { icon: <FileText className="size-4" />, text: `更新了需求文档（${source}）` };
    }
    case 'confirmed':
      return { icon: <CheckCircle2 className="size-4" />, text: '确认了需求', highlight: true };
    default:
      return { icon: <FileText className="size-4" />, text: a.type };
  }
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无活动记录</p>;
  }
  return (
    <ol>
      {activities.map((a, i) => {
        const { icon, text, highlight } = describe(a);
        return (
          <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < activities.length - 1 && (
              <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                'z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background',
                highlight ? 'border-green-300 text-green-600' : 'text-muted-foreground',
              )}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-sm', highlight && 'font-medium text-green-700')}>{text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}