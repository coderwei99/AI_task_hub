import { useEffect, useState } from 'react';
import { createTodoSchema, type Priority, type Todo } from '@ai-task-hub/shared';
import { toast } from 'sonner';
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
    const parsed = createTodoSchema.safeParse({ title, originalDescription, priority });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '参数错误');
      return;
    }
    try {
      const todo = await createTodo.mutateAsync({ projectId, input: parsed.data });
      toast.success('Todo 已创建');
      onOpenChange(false);
      onCreated(todo);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建 Todo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">标题 *</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：优化消息加载速度"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-desc">原始描述 *</Label>
            <Textarea
              id="todo-desc"
              value={originalDescription}
              onChange={(e) => setOriginalDescription(e.target.value)}
              rows={5}
              placeholder="把你最初的想法写下来，AI 会帮你逐步澄清…"
            />
          </div>
          <div className="space-y-2">
            <Label>优先级</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={createTodo.isPending}>
            {createTodo.isPending ? '创建中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}