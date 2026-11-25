import { ArrowRight, CheckCircle2, FilePlus2, FileText, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Activity, ExecutionStatus, RequirementStatus } from '@ai-task-hub/shared';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { Markdown } from './Markdown';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface Version { id: string; number: number; document: string; createdAt: number; source: string; restoredFrom?: number }

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

export function ActivityTimeline({ activities, todoId, currentDocument, generating = false }: { activities: Activity[]; todoId?: string; currentDocument?: string; generating?: boolean }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Version | null>(null);
  const qc = useQueryClient();
  const { data: versions = [] } = useQuery({ queryKey: ['versions', todoId, activities], queryFn: () => api.get<Version[]>(`/todos/${todoId}/versions`), enabled: !!todoId });
  const restore = useMutation({
    mutationFn: (version: Version) => api.post(`/todos/${todoId}/versions/${version.id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries();
      setSelected(null);
      toast.success(t('doc.restored'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('doc.rollbackFailed')),
  });
  if (activities.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('activity.empty')}</p>;
  }
  return (
    <><ol>
      {activities.map((a, i) => {
        const { icon, text, highlight } = describe(a, t);
        const version = versions.find((v) => v.id === a.id);
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
              <p className={cn('text-sm', highlight && 'font-medium text-green-700 dark:text-green-400')}>{version?.restoredFrom ? t('doc.restoredFrom', { number: version.restoredFrom }) : text}{version && ` · v${version.number}`}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
              {version && <Button size="sm" variant="ghost" onClick={() => setSelected(version)}>{t('doc.viewVersion')}</Button>}
            </div>
          </li>
        );
      })}
    </ol>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('doc.historyVersion', { number: selected?.number })}</DialogTitle>
          <DialogDescription>{t('doc.restoreHint')}</DialogDescription>
        </DialogHeader>
        {selected && <p className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()} · {selected.restoredFrom ? t('doc.restoredFrom', { number: selected.restoredFrom }) : t(selected.source === 'ai' ? 'activity.sourceAi' : 'activity.sourceUser')}</p>}
        <div className="max-h-[60vh] overflow-y-auto">{selected?.document ? <Markdown content={selected.document} /> : <p>{t('doc.emptyDraft')}</p>}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelected(null)}>{t('common.cancel')}</Button>
          <Button disabled={generating || restore.isPending || selected?.document === currentDocument} onClick={() => selected && restore.mutate(selected)}>{t('doc.restoreVersion')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog></>
  );
}
