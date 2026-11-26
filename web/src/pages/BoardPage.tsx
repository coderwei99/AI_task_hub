import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Copy, Download, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EXECUTION_STATUSES, REQUIREMENT_STATUSES, type Todo } from '@ai-task-hub/shared';
import { useProject, useTodos, useMoveTodo } from '@/api/hooks';
import { ApiClientError } from '@/api/client';
import { BoardColumns } from '@/components/BoardColumns';
import { ProjectFormDialog } from '@/components/ProjectFormDialog';
import { ProjectIcon } from '@/components/ProjectIcon';
import { TodoFormDialog } from '@/components/TodoFormDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMarkdownExport } from '@/lib/useMarkdownExport';

type View = 'requirement' | 'execution';

const VIEW_KEY = 'ath.board.view';
const SHOW_DONE_KEY = 'ath.board.showDone';

export default function BoardPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { data: project, isPending, error, refetch } = useProject(projectId);
  const { data: todos } = useTodos(projectId);
  const moveTodo = useMoveTodo(projectId);
  const { copy, download, isPending: exportPending } = useMarkdownExport();

  const [view, setView] = useState<View>(() =>
    localStorage.getItem(VIEW_KEY) === 'execution' ? 'execution' : 'requirement',
  );
  const [showDone, setShowDone] = useState(() => localStorage.getItem(SHOW_DONE_KEY) === '1');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  function changeView(v: string) {
    const next = v === 'execution' ? 'execution' : 'requirement';
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }
  function changeShowDone(v: boolean) {
    setShowDone(v);
    localStorage.setItem(SHOW_DONE_KEY, v ? '1' : '0');
  }

  if (isPending) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }
  if (error || !project) {
    const isNotFound = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="flex flex-col items-center gap-3 p-20 text-center">
        <p className="text-muted-foreground">
          {isNotFound ? t('board.notFound') : t('board.loadFailed')}
        </p>
        <div className="flex items-center gap-2">
          {!isNotFound && (
            <Button variant="outline" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/projects">
              <ArrowLeft /> {t('board.backToProjects')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const all = todos ?? [];
  const visible = all.filter((t) => showDone || t.executionStatus !== 'done');
  const columns =
    view === 'requirement'
      ? REQUIREMENT_STATUSES.map((s) => ({
          key: s,
          label: t(`requirementStatus.${s}`),
          items: visible.filter((t) => t.requirementStatus === s),
        }))
      : EXECUTION_STATUSES.map((s) => ({
          key: s,
          label: t(`executionStatus.${s}`),
          items: visible.filter((t) => t.executionStatus === s),
        }));

  const pendingCount = all.filter((t) => t.requirementStatus === 'pending').length;
  const polishingCount = all.filter((t) => t.requirementStatus === 'polishing').length;
  const confirmedCount = all.filter((t) => t.requirementStatus === 'confirmed').length;

  function handleCreated(todo: Todo) {
    navigate(`/projects/${projectId}/todos/${todo.id}`);
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ProjectIcon icon={project.icon} color={project.color} />
              <h1 className="truncate text-xl font-semibold">{project.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setEditOpen(true)}
              >
                <Pencil />
              </Button>
            </div>
            {project.description && (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t('board.summary', {
                pending: pendingCount,
                polishing: polishingCount,
                confirmed: confirmedCount,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={confirmedCount === 0 || exportPending}
              title={confirmedCount === 0 ? t('board.noConfirmed') : t('board.copyProjectHint')}
              onClick={() => copy(`/projects/${projectId}/export`)}
            >
              <Copy /> {t('board.copyProject')}
            </Button>
            <Button
              variant="outline"
              disabled={confirmedCount === 0 || exportPending}
              title={confirmedCount === 0 ? t('board.noConfirmed') : undefined}
              onClick={() => download(`/projects/${projectId}/export`, project.name)}
            >
              <Download /> {t('copy.download')}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> {t('board.newTodo')}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Tabs value={view} onValueChange={changeView}>
            <TabsList>
              <TabsTrigger value="requirement">{t('board.viewRequirement')}</TabsTrigger>
              <TabsTrigger value="execution">{t('board.viewExecution')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Switch id="show-done" checked={showDone} onCheckedChange={changeShowDone} />
            <Label htmlFor="show-done" className="text-sm text-muted-foreground">
              {t('board.showDone')}
            </Label>
          </div>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-muted-foreground">{t('board.empty')}</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> {t('board.createFirst')}
          </Button>
        </div>
      ) : (
        <BoardColumns
          view={view}
          columns={columns}
          onCardClick={(todo) => navigate(`/projects/${projectId}/todos/${todo.id}`)}
          onMove={(todoId, target) => moveTodo.mutate({ id: todoId, executionStatus: target })}
        />
      )}

      <TodoFormDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </div>
  );
}
