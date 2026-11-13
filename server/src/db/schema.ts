import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
  ActivityType,
  ExecutionStatus,
  MessageRole,
  Priority,
  RequirementStatus,
} from '@ai-task-hub/shared';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('📁'),
  description: text('description').notNull().default(''),
  techStack: text('techStack').notNull().default(''),
  constraints: text('constraints').notNull().default(''),
  todoSeq: integer('todoSeq').notNull().default(0),
  createdAt: integer('createdAt').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updatedAt').notNull().$defaultFn(() => Date.now()),
});

export const todos = sqliteTable(
  'todos',
  {
    id: text('id').primaryKey(),
    projectId: text('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    originalDescription: text('originalDescription').notNull(),
    requirementDoc: text('requirementDoc').notNull().default(''),
    requirementStatus: text('requirementStatus').$type<RequirementStatus>().notNull().default('pending'),
    executionStatus: text('executionStatus').$type<ExecutionStatus>().notNull().default('todo'),
    priority: text('priority').$type<Priority>().notNull().default('medium'),
    confirmedAt: integer('confirmedAt'),
    createdAt: integer('createdAt').notNull().$defaultFn(() => Date.now()),
    updatedAt: integer('updatedAt').notNull().$defaultFn(() => Date.now()),
  },
  (t) => [
    uniqueIndex('todos_project_number_unique').on(t.projectId, t.number),
    index('todos_project_idx').on(t.projectId),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    todoId: text('todoId')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    createdAt: integer('createdAt').notNull().$defaultFn(() => Date.now()),
  },
  (t) => [index('messages_todo_created_idx').on(t.todoId, t.createdAt)],
);

export const activities = sqliteTable(
  'activities',
  {
    id: text('id').primaryKey(),
    todoId: text('todoId')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    type: text('type').$type<ActivityType>().notNull(),
    payload: text('payload').notNull().default('{}'),
    createdAt: integer('createdAt').notNull().$defaultFn(() => Date.now()),
  },
  (t) => [index('activities_todo_created_idx').on(t.todoId, t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});