import { useTranslation } from 'react-i18next';
import type { ExecutionStatus, Priority, RequirementStatus } from '@ai-task-hub/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const REQUIREMENT_COLORS: Record<RequirementStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  polishing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  ai_ready: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  reconfirm: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
};

const EXECUTION_COLORS: Record<ExecutionStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  paused: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
};

export function RequirementBadge({
  status,
  className,
}: {
  status: RequirementStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={cn('font-normal', REQUIREMENT_COLORS[status], className)}>
      {t(`requirementStatus.${status}`)}
    </Badge>
  );
}

export function ExecutionBadge({
  status,
  className,
}: {
  status: ExecutionStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={cn('font-normal', EXECUTION_COLORS[status], className)}>
      {t(`executionStatus.${status}`)}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className={cn('font-normal', PRIORITY_COLORS[priority], className)}>
      {t(`priority.${priority}`)}
    </Badge>
  );
}
