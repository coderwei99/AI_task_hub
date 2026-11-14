import { useEffect, useState } from 'react';
import { createProjectSchema, type Project, type ProjectColor } from '@ai-task-hub/shared';
import { toast } from 'sonner';
import { useCreateProject, useUpdateProject } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconPicker } from '@/components/IconPicker';

const DEFAULT_ICON = 'lucide:folder';
const DEFAULT_COLOR: ProjectColor = 'blue';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}

export function ProjectFormDialog({ open, onOpenChange, project }: Props) {
  const isEdit = !!project;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [color, setColor] = useState<ProjectColor>(DEFAULT_COLOR);
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [constraints, setConstraints] = useState('');
  const [error, setError] = useState('');

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const pending = createProject.isPending || updateProject.isPending;

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '');
      setIcon(project?.icon ?? DEFAULT_ICON);
      setColor(project?.color ?? DEFAULT_COLOR);
      setDescription(project?.description ?? '');
      setTechStack(project?.techStack ?? '');
      setConstraints(project?.constraints ?? '');
      setError('');
    }
  }, [open, project]);

  async function handleSubmit() {
    const parsed = createProjectSchema.safeParse({ name, icon, color, description, techStack, constraints });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '参数错误');
      return;
    }
    try {
      if (isEdit) {
        await updateProject.mutateAsync({ id: project!.id, input: parsed.data });
        toast.success('项目已更新');
      } else {
        await createProject.mutateAsync(parsed.data);
        toast.success('项目已创建');
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑项目' : '新建项目'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">图标与名称 *</Label>
            <div className="flex items-center gap-3">
              <IconPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：小美客服" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">描述</Label>
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-tech">技术栈</Label>
            <Textarea
              id="project-tech"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              rows={2}
              placeholder="例如：Vue 2 + Element UI"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-constraints">公共约束</Label>
            <Textarea
              id="project-constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={3}
              placeholder="架构、编码规范等"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}