import { useMemo } from 'react';
import { diffLines } from '@ai-task-hub/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function DocumentDiff({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation();
  const rows = useMemo(() => diffLines(before, after), [before, after]);
  const added = rows.filter((r) => r.kind === 'add').length;
  const removed = rows.filter((r) => r.kind === 'remove').length;
  const pairs = useMemo(() => {
    const result: { left?: (typeof rows)[number]; right?: (typeof rows)[number] }[] = [];
    for (let i = 0; i < rows.length;) {
      if (rows[i].kind === 'equal') {
        result.push({ left: rows[i], right: rows[i] });
        i++;
      } else {
        const deleted: typeof rows = [],
          inserted: typeof rows = [];
        while (i < rows.length && rows[i].kind !== 'equal') {
          const row = rows[i++];
          (row.kind === 'remove' ? deleted : inserted).push(row);
        }
        for (let j = 0; j < Math.max(deleted.length, inserted.length); j++)
          result.push({ left: deleted[j], right: inserted[j] });
      }
    }
    return result;
  }, [rows]);
  return (
    <div className="min-w-0 rounded-md border">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs">
        <span>{t('doc.diffDirection')}</span>
        <span className="text-green-700 dark:text-green-400">+{added}</span>
        <span className="text-red-700 dark:text-red-400">−{removed}</span>
      </div>
      {!added && !removed ? (
        <p className="p-4 text-sm text-muted-foreground">{t('doc.noChanges')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-12" />
              <col />
            </colgroup>
            <thead className="bg-muted/40">
              <tr>
                <th colSpan={2} className="border-r border-b px-3 py-2 text-left font-medium">
                  {t('doc.previousDocument')}
                </th>
                <th colSpan={2} className="border-b px-3 py-2 text-left font-medium">
                  {t('doc.targetDocument')}
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {pairs.map(({ left, right }, index) => (
                <tr key={index}>
                  <td
                    className={cn(
                      'select-none px-2 py-0.5 text-right align-top text-muted-foreground',
                      left?.kind === 'remove' && 'bg-red-100 dark:bg-red-950/60',
                    )}
                  >
                    {left?.oldLine}
                  </td>
                  <td
                    className={cn(
                      'whitespace-pre-wrap break-words border-r px-2 py-0.5 align-top [overflow-wrap:anywhere]',
                      !left && 'bg-muted/40',
                      left?.kind === 'remove' &&
                        'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200',
                    )}
                  >
                    {left && (
                      <>
                        <span className="mr-2 select-none">
                          {left.kind === 'remove' ? '−' : ' '}
                        </span>
                        {left.text || ' '}
                      </>
                    )}
                  </td>
                  <td
                    className={cn(
                      'select-none px-2 py-0.5 text-right align-top text-muted-foreground',
                      right?.kind === 'add' && 'bg-green-100 dark:bg-green-950/60',
                    )}
                  >
                    {right?.newLine}
                  </td>
                  <td
                    className={cn(
                      'whitespace-pre-wrap break-words px-2 py-0.5 align-top [overflow-wrap:anywhere]',
                      !right && 'bg-muted/40',
                      right?.kind === 'add' &&
                        'bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200',
                    )}
                  >
                    {right && (
                      <>
                        <span className="mr-2 select-none">{right.kind === 'add' ? '+' : ' '}</span>
                        {right.text || ' '}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
