import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  createTodoSchema,
  parseWithLocale,
  PRIORITIES,
  REQUIREMENT_DOC_MAX_LENGTH,
  type Priority,
  type Todo,
} from '@ai-task-hub/shared';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import { useCreateTodo } from '@/api/hooks';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [markdown, setMarkdown] = useState<{ name: string; content: string } | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const createTodo = useCreateTodo();

  useEffect(() => {
    if (open) {
      setTitle('');
      setOriginalDescription('');
      setPriority('medium');
      setMarkdown(null);
      setReadingFile(false);
      setError('');
    }
  }, [open]);

  async function readMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    setError('');
    if (!/\.(md|markdown)$/i.test(file.name)) {
      setError(t('todoForm.markdownInvalid'));
      return;
    }
    if (file.size > REQUIREMENT_DOC_MAX_LENGTH * 4 + 3) {
      setError(t('todoForm.markdownTooLong', { count: REQUIREMENT_DOC_MAX_LENGTH }));
      return;
    }

    setReadingFile(true);
    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (fileInput.current !== input) return;
      if (!content.trim()) {
        setError(t('todoForm.markdownEmpty'));
        return;
      }
      if (content.length > REQUIREMENT_DOC_MAX_LENGTH) {
        setError(t('todoForm.markdownTooLong', { count: REQUIREMENT_DOC_MAX_LENGTH }));
        return;
      }
      const filenameTitle = file.name.replace(/\.(md|markdown)$/i, '').trim();
      setTitle((current) => current || filenameTitle.slice(0, 200));
      setMarkdown({ name: file.name, content });
    } catch {
      if (fileInput.current === input) setError(t('todoForm.markdownReadFailed'));
    } finally {
      if (fileInput.current === input) setReadingFile(false);
    }
  }

  async function handleSubmit() {
    if (readingFile || createTodo.isPending) return;
    const parsed = parseWithLocale(
      createTodoSchema,
      {
        title,
        originalDescription: originalDescription.trim() || (markdown ? title : ''),
        priority,
        requirementDoc: markdown?.content,
      },
      currentLocale(),
    );
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
          <div className="space-y-2">
            <Label htmlFor="todo-markdown">{t('todoForm.importMarkdown')}</Label>
            <Input
              ref={fileInput}
              id="todo-markdown"
              type="file"
              accept=".md,.markdown"
              disabled={readingFile || createTodo.isPending}
              onChange={readMarkdown}
            />
            {markdown && (
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate" title={markdown.name}>
                  {markdown.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readingFile || createTodo.isPending}
                  onClick={() => setMarkdown(null)}
                >
                  {t('todoForm.removeMarkdown')}
                </Button>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={readingFile || createTodo.isPending}>
            {createTodo.isPending ? t('common.creating') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
