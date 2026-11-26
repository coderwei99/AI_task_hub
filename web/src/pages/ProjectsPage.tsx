import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ProjectWithStats } from '@ai-task-hub/shared';
import { useDeleteProject, useProjects, useSettings } from '@/api/hooks';
import { PageError } from '@/components/PageError';
import { ProjectFormDialog } from '@/components/ProjectFormDialog';
import { ProjectIcon } from '@/components/ProjectIcon';
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
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { relativeTime } from '@/lib/format';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects, isPending, error, refetch } = useProjects();
  const { data: settings } = useSettings();
  const deleteProject = useDeleteProject();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWithStats | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: ProjectWithStats) {
    setEditing(p);
    setFormOpen(true);
  }
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteProject.mutateAsync(deleting.id);
      toast.success(t('projects.deleted'));
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.deleteFailed'));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('projects.title')}</h1>
        <Button onClick={openCreate}>
          <Plus /> {t('projects.create')}
        </Button>
      </div>

      {settings && !(settings.baseUrl && settings.hasApiKey && settings.model) && (
        <Card className="mb-6 flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('settings.firstRunHint')}</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">{t('chat.goConfigure')}</Link>
          </Button>
        </Card>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : error ? (
        <PageError message={t('projects.loadFailed')} onRetry={() => refetch()} />
      ) : !projects?.length ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">{t('projects.empty')}</p>
          <Button onClick={openCreate}>
            <Plus /> {t('projects.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer p-5 transition-colors hover:bg-accent/50"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <ProjectIcon icon={p.icon} color={p.color} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openEdit(p)}>
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(p)}>
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {p.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{t('projects.statTotal', { count: p.stats.total })}</span>
                <span>{t('projects.statPending', { count: p.stats.pending })}</span>
                <span>{t('projects.statConfirmed', { count: p.stats.confirmed })}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('projects.updatedAt', { time: relativeTime(p.updatedAt) })}
              </p>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('projects.deleteTitle', { name: deleting?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('projects.deleteDesc')}</AlertDialogDescription>
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
    </div>
  );
}
