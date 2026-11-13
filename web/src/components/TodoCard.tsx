import { formatTodoNumber, type Todo } from '@ai-task-hub/shared';
import { Copy } from 'lucide-react';
import { ExecutionBadge, PriorityBadge, RequirementBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/format';
import { useCopyMarkdown } from '@/lib/useCopyMarkdown';

interface Props {
  todo: Todo;
  view: 'requirement' | 'execution';
  onClick: () => void;
}

export function TodoCard({ todo, view, onClick }: Props) {
  const { copy, isPending } = useCopyMarkdown();
  return (
    <Card
      className="cursor-pointer gap-2 p-3 transition-colors hover:bg-accent/50"
      onClick={onClick}
      data-todo-id={todo.id}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{formatTodoNumber(todo.number)}</span>
        <div className="flex items-center gap-1">
          <span>{relativeTime(todo.updatedAt)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title="Copy Markdown"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              copy(`/todos/${todo.id}/export`);
            }}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
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