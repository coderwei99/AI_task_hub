import { useState } from 'react';
import { Eye, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Activity, Todo } from '@ai-task-hub/shared';
import { useUpdateTodo } from '@/api/hooks';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RequirementDocPanelProps {
  todo: Todo;
  activities: Activity[];
}

export function RequirementDocPanel({ todo }: RequirementDocPanelProps) {
  const { t } = useTranslation();
  const updateTodo = useUpdateTodo();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState('');


  function startEdit() {
    setDraft(todo.requirementDoc);
    setPreview(false);
    setEditing(true);
  }

  async function saveEdit() {
    try {
      await updateTodo.mutateAsync({ id: todo.id, input: { requirementDoc: draft } });
      setEditing(false);
      toast.success(t('doc.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('doc.saveFailed'));
    }
  }


  if (editing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {preview ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {draft ? (
                <Markdown content={draft} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">{t('doc.emptyDraft')}</p>
              )}
            </div>
          ) : (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('doc.placeholder')}
              className="min-h-0 flex-1 resize-none font-mono text-sm [field-sizing:fixed]"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil /> : <Eye />} {preview ? t('doc.edit') : t('doc.preview')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X /> {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={updateTodo.isPending}>
              <Save /> {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {todo.requirementDoc ? (
          <Markdown content={todo.requirementDoc} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('doc.empty')}</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t p-2">
        <Button variant="outline" size="sm" onClick={startEdit}>
          <Pencil /> {t('doc.editDoc')}
        </Button>
      </div>
    </div>
  );
}
