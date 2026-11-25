import { formatMessage, type ApiErrorBody } from '@ai-task-hub/shared';
import { currentLocale } from '@/i18n';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function toApiError(res: Response): Promise<ApiClientError> {
  let code = 'ERROR';
  let message = formatMessage(currentLocale(), 'requestFailed', { status: res.status });
  try {
    const data = (await res.json()) as ApiErrorBody;
    if (data.error) {
      code = data.error.code;
      message = data.error.message;
    }
  } catch {}
  return new ApiClientError(res.status, code, message);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Accept-Language': currentLocale(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

async function requestText(path: string): Promise<string> {
  const res = await fetch(`/api${path}`, {
    method: 'GET',
    headers: { 'Accept-Language': currentLocale() },
  });
  if (!res.ok) throw await toApiError(res);
  return res.text();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  getText: (path: string) => requestText(path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
