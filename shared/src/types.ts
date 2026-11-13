export const REQUIREMENT_STATUSES = ['pending', 'polishing', 'ai_ready', 'confirmed', 'reconfirm'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const EXECUTION_STATUSES = ['todo', 'in_progress', 'review', 'done', 'paused'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  pending: '待打磨',
  polishing: '打磨中',
  ai_ready: 'AI 已完成分析',
  confirmed: '已确认',
  reconfirm: '需重新确认',
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  todo: '待执行',
  in_progress: '进行中',
  review: '待验收',
  done: '已完成',
  paused: '已暂停',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export interface Project {
  id: string;
  name: string;
  icon: string;
  description: string;
  techStack: string;
  constraints: string;
  todoSeq: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectStats {
  total: number;
  pending: number;
  confirmed: number;
}

export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

export interface Todo {
  id: string;
  projectId: string;
  number: number;
  title: string;
  originalDescription: string;
  requirementDoc: string;
  requirementStatus: RequirementStatus;
  executionStatus: ExecutionStatus;
  priority: Priority;
  confirmedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  todoId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export const ACTIVITY_TYPES = [
  'todo_created',
  'requirement_status_changed',
  'execution_status_changed',
  'doc_updated',
  'confirmed',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  id: string;
  todoId: string;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TaskWithProject extends Todo {
  project: { id: string; name: string; icon: string } | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function formatTodoNumber(n: number): string {
  return `TASK-${String(n).padStart(3, '0')}`;
}