import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  EXECUTION_STATUSES,
  PRIORITIES,
  canConfirm,
  formatTodoNumber,
  type ExecutionStatus,
  type Priority,
} from '@ai-task-hub/shared';
import {
  useActivities,
  useConfirmTodo,
  useDeleteTodo,
  useProject,
  useTodo,
  useUpdateTodo,
} from '@/api/hooks';
import { ApiClientError } from '@/api/client';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { ChatPanel } from '@/components/ChatPanel';
import { Markdown } from '@/components/Markdown';
import { ProjectIcon } from '@/components/ProjectIcon';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCopyMarkdown } from '@/lib/useCopyMarkdown';
import { useMediaQuery } from '@/lib/useMediaQuery';

export default function TodoDetailPage() {
  const { t } = useTranslation();
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
  const [generating, setGenerating] = useState(false);

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
      toast.error(e instanceof Error ? e.message : t('todo.titleSaveFailed'));
    }
  }
  async function confirmDelete() {
    if (!todo) return;
    try {
      await deleteTodo.mutateAsync(todo.id);
      toast.success(t('todo.deleted'));
      navigate(`/projects/${projectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.deleteFailed'));
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
      toast.success(t('todo.confirmed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('todo.confirmFailed'));
    }
  }

  if (isPending) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }
  if (error || !todo) {
    const isNotFound = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="flex flex-col items-center gap-3 p-20 text-center">
        <p className="text-muted-foreground">
          {isNotFound ? t('todo.notFound') : t('todo.loadFailed')}
        </p>
        <div className="flex items-center gap-2">
          {!isNotFound && (
            <Button variant="outline" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft /> {t('todo.backToBoard')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const confirmable = canConfirm(todo.requirementStatus, todo.requirementDoc, generating);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4 pb-3 md:p-6 md:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Link
              to={`/projects/${projectId}`}
              className="flex items-center gap-1 hover:text-foreground"
            >
              {project && <ProjectIcon icon={project.icon} color={project.color} size="sm" />}
              <span className="truncate">{project?.name ?? t('todo.projectFallback')}</span>
            </Link>
            <span>/</span>
            <span className="font-mono">{formatTodoNumber(todo.number)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              disabled={copyPending}
              onClick={() => copy(`/todos/${todo.id}/export`)}
            >
              <Copy /> Copy
            </Button>
            <Button
              disabled={!confirmable}
              title={confirmable ? t('todo.confirm') : t('todo.confirmDisabledHint')}
              onClick={handleConfirm}
            >
              <Check /> {t('todo.confirm')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  {t('todo.delete')}
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
            title={t('todo.editTitleHint')}
          >
            {todo.title}
          </h1>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <RequirementBadge status={todo.requirementStatus} />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{t('todo.executionStatus')}</span>
            <Select
              value={todo.executionStatus}
              onValueChange={(v) =>
                updateTodo.mutate({ id: todo.id, input: { executionStatus: v as ExecutionStatus } })
              }
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXECUTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`executionStatus.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{t('todo.priority')}</span>
            <Select
              value={todo.priority}
              onValueChange={(v) =>
                updateTodo.mutate({ id: todo.id, input: { priority: v as Priority } })
              }
            >
              <SelectTrigger size="sm" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`priority.${p}`)}
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
              <TabsTrigger value="chat">{t('todo.tabChat')}</TabsTrigger>
              <TabsTrigger value="doc">{t('todo.tabDoc')}</TabsTrigger>
              <TabsTrigger value="activity">{t('todo.tabActivity')}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
            <ChatPanel todo={todo} onConfirm={handleConfirm} onGeneratingChange={setGenerating} />
          </TabsContent>
          <TabsContent value="doc" className="flex min-h-0 flex-1 flex-col">
            <RequirementDocPanel todo={todo} activities={activities ?? []} />
          </TabsContent>
          <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto p-4">
            <ActivityTimeline
              activities={activities ?? []}
              todoId={todo.id}
              currentDocument={todo.requirementDoc}
              generating={generating}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ChatPanel todo={todo} onConfirm={handleConfirm} onGeneratingChange={setGenerating} />

          <div className="flex w-[45%] min-w-0 flex-col">
            <Tabs defaultValue="doc" className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="border-b px-4 pt-2">
                <TabsList variant="line">
                  <TabsTrigger value="doc">{t('todo.tabDoc')}</TabsTrigger>
                  <TabsTrigger value="activity">{t('todo.tabActivity')}</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="doc" className="flex min-h-0 flex-1 flex-col">
                <RequirementDocPanel todo={todo} activities={activities ?? []} />
              </TabsContent>
              <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto p-4">
                <ActivityTimeline
                  activities={activities ?? []}
                  todoId={todo.id}
                  currentDocument={todo.requirementDoc}
                  generating={generating}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('todo.deleteTitle', { title: todo.title })}</AlertDialogTitle>
            <AlertDialogDescription>{t('todo.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('todo.confirmDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('todo.confirmDialogDesc', { title: todo.title })}
            </DialogDescription>
          </DialogHeader>
          {todo.requirementStatus !== 'ai_ready' && todo.requirementStatus !== 'reconfirm' && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t('todo.confirmWarning')}</p>
          )}
          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
            {todo.requirementDoc ? (
              <Markdown content={todo.requirementDoc} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">{t('todo.noDoc')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={doConfirm} disabled={confirmTodo.isPending || !confirmable}>
              <Check /> {t('todo.confirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
