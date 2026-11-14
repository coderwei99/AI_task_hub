import { useState } from 'react';
import { FolderKanban, ListTodo, Menu, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/tasks', label: 'nav.allTasks', icon: ListTodo },
  { to: '/projects', label: 'nav.projects', icon: FolderKanban },
  { to: '/settings', label: 'nav.settings', icon: Settings },
] as const;

function Brand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <span className="text-lg">🧩</span>
      <span className="font-semibold">AI Task Hub</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent font-medium text-accent-foreground',
            )
          }
        >
          <Icon className="size-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:hidden">
        <Button variant="ghost" size="icon" className="size-9" aria-label={t('nav.open')} onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <span className="text-lg">🧩</span>
        <span className="font-semibold">AI Task Hub</span>
        <div className="ml-auto flex items-center">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <Brand />
        <NavLinks />
        <div className="flex items-center justify-between border-t py-2 pr-2 pl-3 text-xs text-muted-foreground">
          <span>{t('nav.footer')}</span>
          <div className="flex items-center">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <Sheet open={open && isMobile} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 gap-0 p-0">
          <SheetTitle className="sr-only">{t('nav.title')}</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t p-3 text-xs text-muted-foreground">{t('nav.footer')}</div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}