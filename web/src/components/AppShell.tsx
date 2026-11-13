import { useState } from 'react';
import { FolderKanban, ListTodo, Menu, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/tasks', label: '全部任务', icon: ListTodo },
  { to: '/projects', label: '我的项目', icon: FolderKanban },
  { to: '/settings', label: '设置', icon: Settings },
];

function Brand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <span className="text-lg">🧩</span>
      <span className="font-semibold">AI Task Hub</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:hidden">
        <Button variant="ghost" size="icon" className="size-9" aria-label="打开导航" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <span className="text-lg">🧩</span>
        <span className="font-semibold">AI Task Hub</span>
      </div>

      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <Brand />
        <NavLinks />
        <div className="border-t p-3 text-xs text-muted-foreground">v0.1.0 · 本地单机</div>
      </aside>

      <Sheet open={open && isMobile} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 gap-0 p-0">
          <SheetTitle className="sr-only">导航</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t p-3 text-xs text-muted-foreground">v0.1.0 · 本地单机</div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}