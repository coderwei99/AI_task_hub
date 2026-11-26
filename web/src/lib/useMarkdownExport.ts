import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';

export function useMarkdownExport() {
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

  async function download(path: string, basename: string) {
    setIsPending(true);
    try {
      const text = await api.getText(path);
      const safeName = basename
        .replace(/[<>:"/\\|?*]/g, '-')
        .trim()
        .slice(0, 100);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName || 'requirements'}.md`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('copy.downloadFailed'));
    } finally {
      setIsPending(false);
    }
  }

  return { copy, download, isPending };
}
