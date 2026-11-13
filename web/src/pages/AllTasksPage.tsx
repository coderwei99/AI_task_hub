import { useNavigate } from 'react-router';
import { formatTodoNumber } from '@ai-task-hub/shared';
import { useTasks } from '@/api/hooks';
import { PageError } from '@/components/PageError';
import { ExecutionBadge, PriorityBadge, RequirementBadge } from '@/components/badges';
import { relativeTime } from '@/lib/format';

export default function AllTasksPage() {
  const navigate = useNavigate();
  const { data: tasks, isPending, error, refetch } = useTasks();

  const all = tasks ?? [];
  const pendingCount = all.filter((t) => t.requirementStatus === 'pending').length;
  const confirmedCount = all.filter((t) => t.requirementStatus === 'confirmed').length;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">全部任务</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1">全部 {all.length}</span>
        <span className="rounded-full bg-muted px-3 py-1">待打磨 {pendingCount}</span>
        <span className="rounded-full bg-muted px-3 py-1">已确认 {confirmedCount}</span>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : error ? (
        <PageError message="任务加载失败" onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
          <p>还没有任务</p>
          <p className="text-xs">到项目看板中新建 Todo。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">任务</th>
                <th className="px-4 py-2.5 font-medium">所属项目</th>
                <th className="px-4 py-2.5 font-medium">需求状态</th>
                <th className="px-4 py-2.5 font-medium">执行状态</th>
                <th className="px-4 py-2.5 font-medium">优先级</th>
                <th className="px-4 py-2.5 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {all.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/projects/${t.projectId}/todos/${t.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{formatTodoNumber(t.number)}</span>
                      <span className="font-medium">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.project ? (
                      <span className="flex items-center gap-1.5">
                        <span>{t.project.icon}</span>
                        <span>{t.project.name}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <RequirementBadge status={t.requirementStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <ExecutionBadge status={t.executionStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{relativeTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}