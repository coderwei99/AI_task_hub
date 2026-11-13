import { NavLink } from 'react-router';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <Button asChild variant="outline">
        <NavLink to="/projects">返回项目列表</NavLink>
      </Button>
    </div>
  );
}