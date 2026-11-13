import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ProjectWithStats } from '@ai-task-hub/shared';
import { useDeleteProject, useProjects } from '@/api/hooks';
import { ProjectFormDialog } from '@/components/ProjectFormDialog';
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
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
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
      toast.success('项目已删除');
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">我的项目</h1>
        <Button onClick={openCreate}>
          <Plus /> 新建项目
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : !projects?.length ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">还没有项目</p>
          <Button onClick={openCreate}>
            <Plus /> 创建第一个项目
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
                  <span className="text-2xl">{p.icon}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openEdit(p)}>编辑</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(p)}>
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>任务 {p.stats.total}</span>
                <span>待打磨 {p.stats.pending}</span>
                <span>已确认 {p.stats.confirmed}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">更新于 {relativeTime(p.updatedAt)}</p>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目「{deleting?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>将同时删除该项目下的全部 Todo，此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}