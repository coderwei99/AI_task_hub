import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EXECUTION_STATUSES, formatTodoNumber, REQUIREMENT_STATUSES } from '@ai-task-hub/shared';
import { useTasks } from '@/api/hooks';
import { PageError } from '@/components/PageError';
import { ProjectIcon } from '@/components/ProjectIcon';
import { ExecutionBadge, PriorityBadge, RequirementBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { relativeTime } from '@/lib/format';

export default function AllTasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: tasks, isPending, error, refetch } = useTasks();

  const [search, setSearch] = useState('');
  const [project, setProject] = useState('');
  const [requirement, setRequirement] = useState('');
  const [execution, setExecution] = useState('');
  const all = tasks ?? [];
  const projects = new Map(
    all.flatMap((task) => (task.project ? [[task.project.id, task.project.name] as const] : [])),
  );
  const query = search.trim().toLowerCase();
  const number = query.match(/^(?:task-?|#)?(\d+)$/)?.[1];
  const filtered = all.filter(
    (task) =>
      (!project || task.projectId === project) &&
      (!requirement || task.requirementStatus === requirement) &&
      (!execution || task.executionStatus === execution) &&
      (!query ||
        task.title.toLowerCase().includes(query) ||
        formatTodoNumber(task.number).toLowerCase().includes(query) ||
        (number !== undefined && task.number === Number(number))),
  );
  const hasFilters = Boolean(query || project || requirement || execution);
  const filterClass = 'h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm';
  const pendingCount = all.filter((t) => t.requirementStatus === 'pending').length;
  const confirmedCount = all.filter((t) => t.requirementStatus === 'confirmed').length;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('tasks.title')}</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1">
          {t('tasks.countAll', { count: all.length })}
        </span>
        <span className="rounded-full bg-muted px-3 py-1">
          {t('tasks.countPending', { count: pendingCount })}
        </span>
        <span className="rounded-full bg-muted px-3 py-1">
          {t('tasks.countConfirmed', { count: confirmedCount })}
        </span>
      </div>

      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label={t('tasks.search')}
            placeholder={t('tasks.search')}
            className="w-full sm:w-64"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label={t('tasks.colProject')}
            className={filterClass}
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">{t('tasks.allProjects')}</option>
            {[...projects].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('tasks.colRequirement')}
            className={filterClass}
            value={requirement}
            onChange={(event) => setRequirement(event.target.value)}
          >
            <option value="">{t('tasks.allRequirements')}</option>
            {REQUIREMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`requirementStatus.${status}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('tasks.colExecution')}
            className={filterClass}
            value={execution}
            onChange={(event) => setExecution(event.target.value)}
          >
            <option value="">{t('tasks.allExecutions')}</option>
            {EXECUTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`executionStatus.${status}`)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setProject('');
                setRequirement('');
                setExecution('');
              }}
            >
              {t('tasks.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : error ? (
        <PageError message={t('tasks.loadFailed')} onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
          <p>{t('tasks.empty')}</p>
          <p className="text-xs">{t('tasks.emptyHint')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('tasks.noMatches')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t('tasks.colTask')}</th>
                <th className="px-4 py-2.5 font-medium">{t('tasks.colProject')}</th>
                <th className="px-4 py-2.5 font-medium">{t('tasks.colRequirement')}</th>
                <th className="px-4 py-2.5 font-medium">{t('tasks.colExecution')}</th>
                <th className="px-4 py-2.5 font-medium">{t('tasks.colPriority')}</th>
                <th className="px-4 py-2.5 font-medium">{t('tasks.colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/projects/${t.projectId}/todos/${t.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatTodoNumber(t.number)}
                      </span>
                      <span className="font-medium">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.project ? (
                      <span className="flex items-center gap-1.5">
                        <ProjectIcon icon={t.project.icon} color={t.project.color} size="sm" />
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
