import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (message = '资源不存在') => new ApiError(404, 'NOT_FOUND', message);
export const badRequest = (message: string) => new ApiError(400, 'VALIDATION', message);
export const conflict = (message: string) => new ApiError(409, 'CONFLICT', message);