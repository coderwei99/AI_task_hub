import { FolderKanban, ListTodo, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/tasks', label: '全部任务', icon: ListTodo },
  { to: '/projects', label: '我的项目', icon: FolderKanban },
  { to: '/settings', label: '设置', icon: Settings },
];

export default function AppShell() {
  return (
    <div className="flex h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <span className="text-lg">🧩</span>
          <span className="font-semibold">AI Task Hub</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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
        <div className="border-t p-3 text-xs text-muted-foreground">v0.1.0 · 本地单机</div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}