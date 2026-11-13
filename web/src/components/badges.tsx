import {
  EXECUTION_STATUS_LABELS,
  PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  type ExecutionStatus,
  type Priority,
  type RequirementStatus,
} from '@ai-task-hub/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const REQUIREMENT_COLORS: Record<RequirementStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  polishing: 'bg-blue-100 text-blue-700',
  ai_ready: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  reconfirm: 'bg-orange-100 text-orange-700',
};

const EXECUTION_COLORS: Record<ExecutionStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  paused: 'bg-zinc-200 text-zinc-500',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

export function RequirementBadge({ status, className }: { status: RequirementStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', REQUIREMENT_COLORS[status], className)}>
      {REQUIREMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ExecutionBadge({ status, className }: { status: ExecutionStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', EXECUTION_COLORS[status], className)}>
      {EXECUTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', PRIORITY_COLORS[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}