import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  EXECUTION_STATUSES,
  EXECUTION_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  canConfirm,
  formatTodoNumber,
  type ExecutionStatus,
  type Priority,
} from '@ai-task-hub/shared';
import { useActivities, useDeleteTodo, useProject, useTodo, useUpdateTodo } from '@/api/hooks';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { Markdown } from '@/components/Markdown';
import { RequirementBadge } from '@/components/badges';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TodoDetailPage() {
  const { projectId = '', todoId = '' } = useParams();
  const navigate = useNavigate();
  const { data: todo, isLoading, error } = useTodo(todoId);
  const { data: project } = useProject(projectId);
  const { data: activities } = useActivities(todoId);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  function startEditTitle() {
    if (!todo) return;
    setTitleDraft(todo.title);
    setEditingTitle(true);
  }
  async function saveTitle() {
    setEditingTitle(false);
    if (!todo) return;
    const next = titleDraft.trim();
    if (!next || next === todo.title) return;
    try {
      await updateTodo.mutateAsync({ id: todo.id, input: { title: next } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '标题保存失败');
    }
  }
  async function confirmDelete() {
    if (!todo) return;
    try {
      await deleteTodo.mutateAsync(todo.id);
      toast.success('Todo 已删除');
      navigate(`/projects/${projectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中…</div>;
  }
  if (error || !todo) {
    return (
      <div className="flex flex-col items-center gap-3 p-20 text-center">
        <p className="text-muted-foreground">Todo 不存在或已被删除</p>
        <Button variant="outline" asChild>
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft /> 返回看板
          </Link>
        </Button>
      </div>
    );
  }

  const confirmable = canConfirm(todo.requirementStatus);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-6 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}`} className="flex items-center gap-1 hover:text-foreground">
              <span>{project?.icon}</span>
              <span className="truncate">{project?.name ?? '项目'}</span>
            </Link>
            <span>/</span>
            <span className="font-mono">{formatTodoNumber(todo.number)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => toast.info('Todo Markdown 导出将在 M3 实现')}>
              <Copy /> Copy
            </Button>
            <Button
              disabled={!confirmable}
              title={confirmable ? '确认需求' : 'AI 完成分析后可确认'}
              onClick={() => toast.info('确认需求将在 M2 实现')}
            >
              <Check /> 确认需求
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  删除 Todo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {editingTitle ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            className="mt-2 h-9 max-w-2xl text-lg font-semibold"
          />
        ) : (
          <h1
            className="mt-2 cursor-text truncate text-lg font-semibold hover:bg-accent/50 rounded px-1 -mx-1"
            onClick={startEditTitle}
            title="点击编辑标题"
          >
            {todo.title}
          </h1>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <RequirementBadge status={todo.requirementStatus} />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">执行状态</span>
            <Select
              value={todo.executionStatus}
              onValueChange={(v) => updateTodo.mutate({ id: todo.id, input: { executionStatus: v as ExecutionStatus } })}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXECUTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EXECUTION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">优先级</span>
            <Select
              value={todo.priority}
              onValueChange={(v) => updateTodo.mutate({ id: todo.id, input: { priority: v as Priority } })}
            >
              <SelectTrigger size="sm" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[55%] min-w-0 flex-col border-r">
          <div className="border-b px-4 py-2 text-sm font-medium">AI 对话</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <p>AI 需求打磨对话将在 M2 实现。</p>
            <p className="text-xs">届时可在此与 AI 多轮澄清需求，右侧实时生成需求文档。</p>
          </div>
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input disabled placeholder="继续补充需求或回答 AI 的问题…" />
              <Button disabled>发送</Button>
            </div>
          </div>
        </div>

        <div className="flex w-[45%] min-w-0 flex-col">
          <Tabs defaultValue="doc" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="border-b px-4 pt-2">
              <TabsList variant="line">
                <TabsTrigger value="doc">需求文档</TabsTrigger>
                <TabsTrigger value="activity">活动记录</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="doc" className="min-h-0 flex-1 overflow-y-auto p-4">
              {todo.requirementDoc ? (
                <Markdown content={todo.requirementDoc} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  暂无需求文档，AI 打磨后自动生成。
                </p>
              )}
            </TabsContent>
            <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto p-4">
              <ActivityTimeline activities={activities ?? []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{todo.title}」？</AlertDialogTitle>
            <AlertDialogDescription>将同时删除该 Todo 的对话与活动记录，此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}