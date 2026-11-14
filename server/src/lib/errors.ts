import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  DEFAULT_LOCALE,
  formatMessage,
  resolveLocale,
  type ErrorKey,
  type Locale,
  type MessageParams,
} from '@ai-task-hub/shared';

/** Carries a message key so the text can be rendered in the requester's language at the response boundary. */
export class LocalizedError extends Error {
  constructor(
    public key: ErrorKey,
    public params?: MessageParams,
  ) {
    super(formatMessage(DEFAULT_LOCALE, key, params));
    this.name = 'LocalizedError';
  }

  localize(locale: Locale): string {
    return formatMessage(locale, this.key, this.params);
  }
}

export class ApiError extends LocalizedError {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    key: ErrorKey,
    params?: MessageParams,
    private detail?: string,
  ) {
    super(key, params);
    this.name = 'ApiError';
    if (detail) this.message = detail;
  }

  override localize(locale: Locale): string {
    return this.detail ?? super.localize(locale);
  }
}

export const notFound = (key: ErrorKey = 'notFound') => new ApiError(404, 'NOT_FOUND', key);
export const badRequest = (key: ErrorKey) => new ApiError(400, 'VALIDATION', key);
export const validationError = (detail: string) => new ApiError(400, 'VALIDATION', 'invalidParams', undefined, detail);
export const conflict = (key: ErrorKey) => new ApiError(409, 'CONFLICT', key);

export const requestLocale = (c: Context): Locale => resolveLocale(c.req.header('accept-language'));

export function localizeError(e: unknown, locale: Locale, fallback: ErrorKey): string {
  if (e instanceof LocalizedError) return e.localize(locale);
  if (e instanceof Error && e.message) return e.message;
  return formatMessage(locale, fallback);
}
