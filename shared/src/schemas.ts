import { z } from 'zod';
import { EXECUTION_STATUSES, PRIORITIES } from './types';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, '项目名称不能为空').max(100),
  icon: z.string().max(8).default('📁'),
  description: z.string().max(2000).default(''),
  techStack: z.string().max(5000).default(''),
  constraints: z.string().max(10000).default(''),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200),
  originalDescription: z.string().trim().min(1, '原始描述不能为空').max(20000),
  priority: z.enum(PRIORITIES).default('medium'),
});
export type CreateTodoInput = z.infer<typeof createTodoSchema>;

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  priority: z.enum(PRIORITIES).optional(),
  executionStatus: z.enum(EXECUTION_STATUSES).optional(),
  requirementDoc: z.string().max(100000).optional(),
});
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

export const chatInputSchema = z.object({
  content: z.string().trim().min(1, '消息不能为空').max(20000),
});
export type ChatInput = z.infer<typeof chatInputSchema>;

export const aiSettingsSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;