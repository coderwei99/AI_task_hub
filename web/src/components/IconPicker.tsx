import { useMemo, useState } from 'react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { useTranslation } from 'react-i18next';
import { PROJECT_COLORS, type ProjectColor } from '@ai-task-hub/shared';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectIcon } from '@/components/ProjectIcon';
import { cn } from '@/lib/utils';
import {
  CURATED_ICONS,
  CURATED_ICON_MAP,
  EMOJI_PRESETS,
  PROJECT_COLOR_STYLES,
  lucideIcon,
  parseIcon,
} from '@/lib/project-icon';

const MAX_RESULTS = 120;

interface Props {
  icon: string;
  color: ProjectColor;
  onIconChange: (icon: string) => void;
  onColorChange: (color: ProjectColor) => void;
}

export function IconPicker({ icon, color, onIconChange, onColorChange }: Props) {
  const { t } = useTranslation();
  const parsed = parseIcon(icon);
  const [tab, setTab] = useState<string>(parsed.kind === 'emoji' ? 'emoji' : 'icon');
  const [query, setQuery] = useState('');
  const [customEmoji, setCustomEmoji] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_ICONS.map((i) => i.name);
    const slug = q.replace(/\s+/g, '-');
    const curated = CURATED_ICONS.filter(
      (i) => i.name.includes(slug) || i.keywords.includes(q),
    ).map((i) => i.name);
    const seen = new Set(curated);
    const rest = iconNames.filter((n) => !seen.has(n) && n.includes(slug));
    return [...curated, ...rest].slice(0, MAX_RESULTS);
  }, [query]);

  const selectedLucide = parsed.kind === 'lucide' ? parsed.name : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-lg border transition-colors hover:bg-accent"
          aria-label={t('iconPicker.trigger')}
        >
          <ProjectIcon icon={icon} color={color} size="lg" />
        </button>
      </PopoverTrigger>
      <PopoverContent portal={false} align="start" className="w-80 p-0">
        <Tabs value={tab} onValueChange={setTab} className="gap-0">
          <div className="border-b px-3 pt-2">
            <TabsList variant="line">
              <TabsTrigger value="icon">{t('iconPicker.icons')}</TabsTrigger>
              <TabsTrigger value="emoji">{t('iconPicker.emoji')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="icon" className="space-y-3 p-3">
            <div className="flex items-center gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={t(`projectColor.${c}`)}
                  aria-label={t(`projectColor.${c}`)}
                  onClick={() => onColorChange(c)}
                  className={cn(
                    'size-5 rounded-full ring-offset-2 ring-offset-popover transition-shadow',
                    PROJECT_COLOR_STYLES[c].swatch,
                    color === c ? 'ring-2 ring-ring' : 'hover:ring-2 hover:ring-border',
                  )}
                />
              ))}
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('iconPicker.searchPlaceholder')}
              className="h-8"
            />
            {results.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t('iconPicker.noMatch')}
              </p>
            ) : (
              <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
                {results.map((name) => {
                  const Static = CURATED_ICON_MAP.get(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => onIconChange(lucideIcon(name))}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-md transition-colors',
                        selectedLucide === name
                          ? cn('ring-2 ring-ring', PROJECT_COLOR_STYLES[color].tile)
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {Static ? (
                        <Static className="size-4" />
                      ) : (
                        <DynamicIcon
                          name={name as IconName}
                          className="size-4"
                          fallback={() => <span className="size-4" />}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {query.trim() && results.length === MAX_RESULTS && (
              <p className="text-xs text-muted-foreground">
                {t('iconPicker.truncated', { count: MAX_RESULTS })}
              </p>
            )}
          </TabsContent>

          <TabsContent value="emoji" className="space-y-3 p-3">
            <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onIconChange(e)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-lg transition-colors',
                    icon === e ? 'bg-accent ring-2 ring-ring' : 'hover:bg-accent',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const v = customEmoji.trim();
                if (v) onIconChange(v);
              }}
            >
              <Input
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                placeholder={t('iconPicker.customEmoji')}
                maxLength={16}
                className="h-8"
              />
            </form>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
