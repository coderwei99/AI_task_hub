import i18n from '@/i18n';

function intlLocale(): string {
  return i18n.language === 'zh' ? 'zh-CN' : 'en';
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  if (diff < min) return rtf.format(0, 'second');
  if (diff < hour) return rtf.format(-Math.floor(diff / min), 'minute');
  if (diff < day) return rtf.format(-Math.floor(diff / hour), 'hour');
  if (diff < 7 * day) return rtf.format(-Math.floor(diff / day), 'day');
  return new Date(ts).toLocaleDateString(intlLocale());
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(intlLocale(), { hour12: false });
}
