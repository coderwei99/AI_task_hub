import { ArrowRight, CheckCircle2, FilePlus2, FileText, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Activity, ExecutionStatus, RequirementStatus } from '@ai-task-hub/shared';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Reason = 'chat' | 'ai_sufficient' | 'user_confirm' | 'doc_edit';

function describe(a: Activity, t: TFunction): { icon: React.ReactNode; text: string; highlight?: boolean } {
  const p = a.payload;
  switch (a.type) {
    case 'todo_created':
      return { icon: <FilePlus2 className="size-4" />, text: t('activity.created') };
    case 'requirement_status_changed': {
      const from = t(`requirementStatus.${p.from as RequirementStatus}`, { defaultValue: String(p.from) });
      const to = t(`requirementStatus.${p.to as RequirementStatus}`, { defaultValue: String(p.to) });
      const text = p.reason
        ? t('activity.requirementChangedWithReason', {
            from,
            to,
            reason: t(`activity.reasons.${p.reason as Reason}`, { defaultValue: String(p.reason) }),
          })
        : t('activity.requirementChanged', { from, to });
      return { icon: <RefreshCw className="size-4" />, text };
    }
    case 'execution_status_changed': {
      const from = t(`executionStatus.${p.from as ExecutionStatus}`, { defaultValue: String(p.from) });
      const to = t(`executionStatus.${p.to as ExecutionStatus}`, { defaultValue: String(p.to) });
      return { icon: <ArrowRight className="size-4" />, text: t('activity.executionChanged', { from, to }) };
    }
    case 'doc_updated': {
      const source = p.source === 'ai' ? t('activity.sourceAi') : t('activity.sourceUser');
      return { icon: <FileText className="size-4" />, text: t('activity.docUpdated', { source }) };
    }
    case 'confirmed':
      return { icon: <CheckCircle2 className="size-4" />, text: t('activity.confirmed'), highlight: true };
    default:
      return { icon: <FileText className="size-4" />, text: a.type };
  }
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const { t } = useTranslation();
  if (activities.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('activity.empty')}</p>;
  }
  return (
    <ol>
      {activities.map((a, i) => {
        const { icon, text, highlight } = describe(a, t);
        return (
          <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < activities.length - 1 && (
              <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                'z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background',
                highlight ? 'border-green-300 text-green-600 dark:border-green-500/40 dark:text-green-400' : 'text-muted-foreground',
              )}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-sm', highlight && 'font-medium text-green-700 dark:text-green-400')}>{text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}