import { nanoid } from 'nanoid';
import type { ActivityType } from '@ai-task-hub/shared';
import { db } from '../db';
import { activities } from '../db/schema';

export function logActivity(
  todoId: string,
  type: ActivityType,
  payload: Record<string, unknown> = {},
  executor: Pick<typeof db, 'insert'> = db,
): void {
  executor
    .insert(activities)
    .values({
      id: nanoid(),
      todoId,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    })
    .run();
}