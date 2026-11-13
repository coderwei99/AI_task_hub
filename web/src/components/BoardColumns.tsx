import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ExecutionStatus, Todo } from '@ai-task-hub/shared';
import { TodoCard } from '@/components/TodoCard';
import { cn } from '@/lib/utils';

export interface BoardColumn {
  key: string;
  label: string;
  items: Todo[];
}

interface Props {
  view: 'requirement' | 'execution';
  columns: BoardColumn[];
  onCardClick: (todo: Todo) => void;
  onMove: (todoId: string, target: ExecutionStatus) => void;
}

function ColumnShell({
  label,
  count,
  isOver,
  children,
}: {
  label: string;
  count: number;
  isOver?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-lg bg-muted/40 p-2 transition-colors',
        isOver && 'bg-accent/60 ring-2 ring-ring/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
        <span className="truncate">{label}</span>
        <span className="ml-2 shrink-0 rounded-full bg-background px-2 text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {count === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground/60">暂无任务</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function DraggableCard({ todo, onClick }: { todo: Todo; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn('touch-none', isDragging && 'opacity-50')}
      {...listeners}
      {...attributes}
    >
      <TodoCard todo={todo} view="execution" onClick={onClick} />
    </div>
  );
}

function DroppableColumn({
  column,
  onCardClick,
}: {
  column: BoardColumn;
  onCardClick: (todo: Todo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className="flex min-h-0 flex-col">
      <ColumnShell label={column.label} count={column.items.length} isOver={isOver}>
        {column.items.map((todo) => (
          <DraggableCard key={todo.id} todo={todo} onClick={() => onCardClick(todo)} />
        ))}
      </ColumnShell>
    </div>
  );
}

export function BoardColumns({ view, columns, onCardClick, onMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  if (view === 'requirement') {
    return (
      <div className="grid flex-1 grid-flow-col gap-3 overflow-x-auto auto-cols-[minmax(12rem,1fr)] md:auto-cols-[minmax(0,1fr)] md:overflow-hidden">
        {columns.map((col) => (
          <ColumnShell key={col.key} label={col.label} count={col.items.length}>
            {col.items.map((todo) => (
              <TodoCard key={todo.id} todo={todo} view="requirement" onClick={() => onCardClick(todo)} />
            ))}
          </ColumnShell>
        ))}
      </div>
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const todoId = String(active.id);
    const target = String(over.id) as ExecutionStatus;
    const todo = columns.flatMap((c) => c.items).find((t) => t.id === todoId);
    if (!todo || todo.executionStatus === target) return;
    onMove(todoId, target);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} autoScroll={false} onDragEnd={handleDragEnd}>
      <div className="grid flex-1 grid-flow-col gap-3 overflow-x-auto auto-cols-[minmax(12rem,1fr)] md:auto-cols-[minmax(0,1fr)] md:overflow-hidden">
        {columns.map((col) => (
          <DroppableColumn key={col.key} column={col} onCardClick={onCardClick} />
        ))}
      </div>
    </DndContext>
  );
}