import { z } from 'zod';
import type { ErrorKey } from './i18n';
import { EXECUTION_STATUSES, LUCIDE_ICON_PREFIX, PRIORITIES, PROJECT_COLORS } from './types';

const msg = (key: ErrorKey) => key;

const projectIconSchema = z
  .string()
  .trim()
  .min(1, msg('iconRequired'))
  .max(80)
  .refine(
    (v) => (v.startsWith(LUCIDE_ICON_PREFIX) ? /^lucide:[a-z0-9-]+$/.test(v) : v.length <= 16),
    msg('iconInvalid'),
  );

const projectFields = {
  name: z.string().trim().min(1, msg('projectNameRequired')).max(100),
  icon: projectIconSchema,
  color: z.enum(PROJECT_COLORS),
  description: z.string().max(2000),
  techStack: z.string().max(5000),
  constraints: z.string().max(10000),
};

export const createProjectSchema = z.object({
  ...projectFields,
  icon: projectFields.icon.default('📁'),
  color: projectFields.color.default('gray'),
  description: projectFields.description.default(''),
  techStack: projectFields.techStack.default(''),
  constraints: projectFields.constraints.default(''),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Built from defaults-free fields: zod 4 still applies .default() inside .partial(), which would reset omitted fields on PATCH
export const updateProjectSchema = z.object(projectFields).partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, msg('titleRequired')).max(200),
  originalDescription: z.string().trim().min(1, msg('descriptionRequired')).max(20000),
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
  content: z.string().trim().min(1, msg('messageRequired')).max(20000),
});
export type ChatInput = z.infer<typeof chatInputSchema>;

export const aiSettingsSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().trim().optional(),
  model: z.string().min(1),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
