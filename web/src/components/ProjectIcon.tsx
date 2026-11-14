import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import type { ProjectColor } from '@ai-task-hub/shared';
import { cn } from '@/lib/utils';
import { CURATED_ICON_MAP, PROJECT_COLOR_STYLES, parseIcon } from '@/lib/project-icon';

const SIZES = {
  sm: { tile: 'size-5 rounded', icon: 'size-3.5', emoji: 'text-sm' },
  md: { tile: 'size-7 rounded-md', icon: 'size-4', emoji: 'text-lg' },
  lg: { tile: 'size-9 rounded-lg', icon: 'size-5', emoji: 'text-2xl' },
} as const;

interface Props {
  icon: string;
  color: ProjectColor;
  size?: keyof typeof SIZES;
  className?: string;
}

export function ProjectIcon({ icon, color, size = 'md', className }: Props) {
  const parsed = parseIcon(icon);
  const s = SIZES[size];

  if (parsed.kind === 'emoji') {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center leading-none', s.tile, s.emoji, className)}>
        {parsed.value}
      </span>
    );
  }

  const Static = CURATED_ICON_MAP.get(parsed.name);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        s.tile,
        PROJECT_COLOR_STYLES[color]?.tile ?? PROJECT_COLOR_STYLES.gray.tile,
        className,
      )}
    >
      {Static ? (
        <Static className={s.icon} />
      ) : (
        <DynamicIcon name={parsed.name as IconName} className={s.icon} fallback={() => <span className={s.icon} />} />
      )}
    </span>
  );
}
