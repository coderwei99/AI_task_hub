import { useState } from 'react';
import { Eye, Pencil, Save, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Activity, Todo } from '@ai-task-hub/shared';
import { useUpdateTodo } from '@/api/hooks';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RequirementDocPanelProps {
  todo: Todo;
  activities: Activity[];
}

export function RequirementDocPanel({ todo, activities }: RequirementDocPanelProps) {
  const updateTodo = useUpdateTodo();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState('');

  const latestDocUpdate = activities.find((a) => a.type === 'doc_updated');
  const prevDoc = latestDocUpdate?.payload.prevDoc;
  const canRollback = typeof prevDoc === 'string' && prevDoc.length > 0;

  function startEdit() {
    setDraft(todo.requirementDoc);
    setPreview(false);
    setEditing(true);
  }

  async function saveEdit() {
    try {
      await updateTodo.mutateAsync({ id: todo.id, input: { requirementDoc: draft } });
      setEditing(false);
      toast.success('需求文档已保存');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '文档保存失败');
    }
  }

  async function rollback() {
    if (typeof prevDoc !== 'string') return;
    try {
      await updateTodo.mutateAsync({ id: todo.id, input: { requirementDoc: prevDoc } });
      toast.success('已回退到上一版');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '回退失败');
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
                <p className="py-10 text-center text-sm text-muted-foreground">暂无内容</p>
              )}
            </div>
          ) : (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="在此编辑需求文档（Markdown）…"
              className="min-h-0 flex-1 resize-none font-mono text-sm [field-sizing:fixed]"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil /> : <Eye />} {preview ? '编辑' : '预览'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X /> 取消
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={updateTodo.isPending}>
              <Save /> 保存
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
          <p className="py-10 text-center text-sm text-muted-foreground">暂无需求文档，AI 打磨后自动生成。</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t p-2">
        {canRollback && (
          <Button variant="outline" size="sm" onClick={rollback} disabled={updateTodo.isPending}>
            <Undo2 /> 回退上一版
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={startEdit}>
          <Pencil /> 编辑文档
        </Button>
      </div>
    </div>
  );
}