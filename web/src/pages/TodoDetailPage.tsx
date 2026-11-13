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
import { useActivities, useConfirmTodo, useDeleteTodo, useProject, useTodo, useUpdateTodo } from '@/api/hooks';
import { ApiClientError } from '@/api/client';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { ChatPanel } from '@/components/ChatPanel';
import { Markdown } from '@/components/Markdown';
import { RequirementDocPanel } from '@/components/RequirementDocPanel';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCopyMarkdown } from '@/lib/useCopyMarkdown';
import { useMediaQuery } from '@/lib/useMediaQuery';

export default function TodoDetailPage() {
  const { projectId = '', todoId = '' } = useParams();
  const navigate = useNavigate();
  const { data: todo, isPending, error, refetch } = useTodo(todoId);
  const { data: project } = useProject(projectId);
  const { data: activities } = useActivities(todoId);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const confirmTodo = useConfirmTodo();
  const { copy, isPending: copyPending } = useCopyMarkdown();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
  function handleConfirm() {
    setConfirmOpen(true);
  }
  async function doConfirm() {
    if (!todo) return;
    try {
      await confirmTodo.mutateAsync(todo.id);
      setConfirmOpen(false);
      toast.success('需求已确认');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '确认失败');
    }
  }

  if (isPending) {
    return <div className="p-6 text-sm text-muted-foreground">加载中…</div>;
  }
  if (error || !todo) {
    const isNotFound = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="flex flex-col items-center gap-3 p-20 text-center">
        <p className="text-muted-foreground">{isNotFound ? 'Todo 不存在或已被删除' : 'Todo 加载失败'}</p>
        <div className="flex items-center gap-2">
          {!isNotFound && (
            <Button variant="outline" onClick={() => refetch()}>
              重试
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft /> 返回看板
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const confirmable = canConfirm(todo.requirementStatus);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4 pb-3 md:p-6 md:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Link to={`/projects/${projectId}`} className="flex items-center gap-1 hover:text-foreground">
              <span>{project?.icon}</span>
              <span className="truncate">{project?.name ?? '项目'}</span>
            </Link>
            <span>/</span>
            <span className="font-mono">{formatTodoNumber(todo.number)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" disabled={copyPending} onClick={() => copy(`/todos/${todo.id}/export`)}>
              <Copy /> Copy
            </Button>
            <Button
              disabled={!confirmable}
              title={confirmable ? '确认需求' : 'AI 完成分析后可确认'}
              onClick={handleConfirm}
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

      {isMobile ? (
        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b px-4 pt-2">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="chat">对话</TabsTrigger>
              <TabsTrigger value="doc">需求文档</TabsTrigger>
              <TabsTrigger value="activity">活动记录</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
            <ChatPanel todo={todo} onConfirm={handleConfirm} />
          </TabsContent>
          <TabsContent value="doc" className="flex min-h-0 flex-1 flex-col">
            <RequirementDocPanel todo={todo} activities={activities ?? []} />
          </TabsContent>
          <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto p-4">
            <ActivityTimeline activities={activities ?? []} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ChatPanel todo={todo} onConfirm={handleConfirm} />

          <div className="flex w-[45%] min-w-0 flex-col">
            <Tabs defaultValue="doc" className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="border-b px-4 pt-2">
                <TabsList variant="line">
                  <TabsTrigger value="doc">需求文档</TabsTrigger>
                  <TabsTrigger value="activity">活动记录</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="doc" className="flex min-h-0 flex-1 flex-col">
                <RequirementDocPanel todo={todo} activities={activities ?? []} />
              </TabsContent>
              <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto p-4">
                <ActivityTimeline activities={activities ?? []} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>确认需求</DialogTitle>
            <DialogDescription>
              确认后「{todo.title}」将标记为已确认，可 Copy 交给 Coding Agent。请核对以下需求文档摘要。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
            {todo.requirementDoc ? (
              <Markdown content={todo.requirementDoc} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">暂无文档内容</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button onClick={doConfirm} disabled={confirmTodo.isPending}>
              <Check /> 确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}