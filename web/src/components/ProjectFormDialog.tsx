import { useEffect, useState } from 'react';
import {
  createProjectSchema,
  parseWithLocale,
  type Project,
  type ProjectColor,
} from '@ai-task-hub/shared';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import { useCreateProject, useUpdateProject } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const { t } = useTranslation();
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
    const parsed = parseWithLocale(
      createProjectSchema,
      { name, icon, color, description, techStack, constraints },
      currentLocale(),
    );
    if (!parsed.success) {
      setError(parsed.message);
      return;
    }
    try {
      if (isEdit) {
        await updateProject.mutateAsync({ id: project!.id, input: parsed.data });
        toast.success(t('projectForm.updated'));
      } else {
        await createProject.mutateAsync(parsed.data);
        toast.success(t('projectForm.created'));
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.saveFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('projectForm.editTitle') : t('projectForm.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t('projectForm.iconAndName')}</Label>
            <div className="flex items-center gap-3">
              <IconPicker
                icon={icon}
                color={color}
                onIconChange={setIcon}
                onColorChange={setColor}
              />
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('projectForm.namePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">{t('projectForm.description')}</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-tech">{t('projectForm.techStack')}</Label>
            <Textarea
              id="project-tech"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              rows={2}
              placeholder={t('projectForm.techStackPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-constraints">{t('projectForm.constraints')}</Label>
            <Textarea
              id="project-constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={3}
              placeholder={t('projectForm.constraintsPlaceholder')}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
