import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';

export function useCopyMarkdown() {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  async function copy(path: string) {
    setIsPending(true);
    try {
      const text = await api.getText(path);
      await navigator.clipboard.writeText(text);
      toast.success(t('copy.done'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('copy.failed'));
    } finally {
      setIsPending(false);
    }
  }

  return { copy, isPending };
}
