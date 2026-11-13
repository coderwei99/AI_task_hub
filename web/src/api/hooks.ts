import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Activity,
  AiSettings,
  CreateProjectInput,
  CreateTodoInput,
  ExecutionStatus,
  Message,
  Project,
  ProjectWithStats,
  TaskWithProject,
  Todo,
  UpdateProjectInput,
  UpdateTodoInput,
} from '@ai-task-hub/shared';
import { api } from './client';

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  todos: (projectId: string) => ['todos', projectId] as const,
  todo: (id: string) => ['todo', id] as const,
  activities: (id: string) => ['activities', id] as const,
  messages: (id: string) => ['messages', id] as const,
  tasks: ['tasks'] as const,
  settings: ['settings'] as const,
};

function useInvalidateTodoRelated() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['project'] });
    qc.invalidateQueries({ queryKey: ['todos'] });
    qc.invalidateQueries({ queryKey: ['todo'] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['activities'] });
  };
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => api.get<ProjectWithStats[]>('/projects'),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.get<ProjectWithStats>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.post<Project>('/projects', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      api.patch<ProjectWithStats>(`/projects/${id}`, input),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.project(id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useTodos(projectId: string) {
  return useQuery({
    queryKey: queryKeys.todos(projectId),
    queryFn: () => api.get<Todo[]>(`/projects/${projectId}/todos`),
    enabled: !!projectId,
  });
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: queryKeys.todo(id),
    queryFn: () => api.get<Todo>(`/todos/${id}`),
    enabled: !!id,
  });
}

export function useCreateTodo() {
  const invalidate = useInvalidateTodoRelated();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: CreateTodoInput }) =>
      api.post<Todo>(`/projects/${projectId}/todos`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTodo() {
  const invalidate = useInvalidateTodoRelated();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTodoInput }) => api.patch<Todo>(`/todos/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTodo() {
  const invalidate = useInvalidateTodoRelated();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/todos/${id}`),
    onSuccess: invalidate,
  });
}

export function useConfirmTodo() {
  const invalidate = useInvalidateTodoRelated();
  return useMutation({
    mutationFn: (id: string) => api.post<Todo>(`/todos/${id}/confirm`),
    onSuccess: invalidate,
  });
}

export function useMoveTodo(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, executionStatus }: { id: string; executionStatus: ExecutionStatus }) =>
      api.patch<Todo>(`/todos/${id}`, { executionStatus }),
    onMutate: async ({ id, executionStatus }) => {
      await qc.cancelQueries({ queryKey: queryKeys.todos(projectId) });
      const prev = qc.getQueryData<Todo[]>(queryKeys.todos(projectId));
      qc.setQueryData<Todo[]>(queryKeys.todos(projectId), (old) =>
        old?.map((t) => (t.id === id ? { ...t, executionStatus } : t)),
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.todos(projectId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.todos(projectId) });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useActivities(todoId: string) {
  return useQuery({
    queryKey: queryKeys.activities(todoId),
    queryFn: () => api.get<Activity[]>(`/todos/${todoId}/activities`),
    enabled: !!todoId,
  });
}

export function useMessages(todoId: string) {
  return useQuery({
    queryKey: queryKeys.messages(todoId),
    queryFn: () => api.get<Message[]>(`/todos/${todoId}/messages`),
    enabled: !!todoId,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => api.get<TaskWithProject[]>('/tasks'),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.get<AiSettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AiSettings) => api.put<AiSettings>('/settings', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (input: AiSettings) => api.post<TestConnectionResult>('/settings/test', input),
  });
}