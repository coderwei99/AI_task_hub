import { formatTodoNumber, type Todo } from '@ai-task-hub/shared';
import { ExecutionBadge, PriorityBadge, RequirementBadge } from '@/components/badges';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/format';

interface Props {
  todo: Todo;
  view: 'requirement' | 'execution';
  onClick: () => void;
}

export function TodoCard({ todo, view, onClick }: Props) {
  return (
    <Card
      className="cursor-pointer gap-2 p-3 transition-colors hover:bg-accent/50"
      onClick={onClick}
      data-todo-id={todo.id}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{formatTodoNumber(todo.number)}</span>
        <span>{relativeTime(todo.updatedAt)}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{todo.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={todo.priority} />
        {view === 'requirement' ? (
          <ExecutionBadge status={todo.executionStatus} />
        ) : (
          <RequirementBadge status={todo.requirementStatus} />
        )}
      </div>
    </Card>
  );
}