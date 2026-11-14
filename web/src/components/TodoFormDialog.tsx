import { useEffect, useState } from 'react';
import { createTodoSchema, parseWithLocale, PRIORITIES, type Priority, type Todo } from '@ai-task-hub/shared';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import { useCreateTodo } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (todo: Todo) => void;
}

export function TodoFormDialog({ projectId, open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [error, setError] = useState('');

  const createTodo = useCreateTodo();

  useEffect(() => {
    if (open) {
      setTitle('');
      setOriginalDescription('');
      setPriority('medium');
      setError('');
    }
  }, [open]);

  async function handleSubmit() {
    const parsed = parseWithLocale(createTodoSchema, { title, originalDescription, priority }, currentLocale());
    if (!parsed.success) {
      setError(parsed.message);
      return;
    }
    try {
      const todo = await createTodo.mutateAsync({ projectId, input: parsed.data });
      toast.success(t('todoForm.created'));
      onOpenChange(false);
      onCreated(todo);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('todoForm.createFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('todoForm.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">{t('todoForm.titleLabel')}</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('todoForm.titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-desc">{t('todoForm.descLabel')}</Label>
            <Textarea
              id="todo-desc"
              value={originalDescription}
              onChange={(e) => setOriginalDescription(e.target.value)}
              rows={5}
              placeholder={t('todoForm.descPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('todoForm.priority')}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="w-40">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createTodo.isPending}>
            {createTodo.isPending ? t('common.creating') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}