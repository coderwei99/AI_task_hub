import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/api/client';

export function useCopyMarkdown() {
  const [isPending, setIsPending] = useState(false);

  async function copy(path: string) {
    setIsPending(true);
    try {
      const text = await api.getText(path);
      await navigator.clipboard.writeText(text);
      toast.success('已复制，可直接粘贴给 Coding Agent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '复制失败');
    } finally {
      setIsPending(false);
    }
  }

  return { copy, isPending };
}