import { z, type ZodType } from 'zod';

export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

export function matchLocale(tag: string): Locale | null {
  const t = tag.trim().toLowerCase();
  if (t.startsWith('zh')) return 'zh';
  if (t.startsWith('en')) return 'en';
  return null;
}

/** Resolves an Accept-Language header or language tag; unknown languages fall back to English. */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  for (const part of input.split(',')) {
    const hit = matchLocale(part.split(';')[0]);
    if (hit) return hit;
  }
  return 'en';
}

const zhErrors = {
  notFound: '资源不存在',
  apiNotFound: '接口不存在',
  projectNotFound: '项目不存在',
  todoNotFound: 'Todo 不存在',
  internal: '服务器内部错误',
  invalidParams: '参数错误',
  requestFailed: '请求失败 ({{status}})',
  iconRequired: '请选择图标',
  iconInvalid: '图标格式不正确',
  projectNameRequired: '项目名称不能为空',
  titleRequired: '标题不能为空',
  descriptionRequired: '原始描述不能为空',
  messageRequired: '消息不能为空',
  aiNotConfigured: '请先在设置页配置 AI 服务（Base URL / API Key / 模型）',
  chatInProgress: '该 Todo 已有进行中的对话，请等待完成或停止后重试',
  chatAborted: '对话已中断',
  aiCallFailed: 'AI 调用失败',
  aiHttpError: 'AI 服务返回 HTTP {{status}}: {{body}}',
  aiTimeout: 'AI 响应超时（{{seconds}}s 无数据）',
  aiEmptyContent: 'AI 未返回有效内容',
  connectionFailed: '连接失败',
  noConfirmedTasks: '暂无已确认任务',
  todoNotConfirmable: '当前需求状态不可确认，请等待 AI 完成分析',
};

export type ErrorKey = keyof typeof zhErrors;
export type MessageParams = Record<string, string | number>;

const enErrors: Record<ErrorKey, string> = {
  notFound: 'Resource not found',
  apiNotFound: 'API endpoint not found',
  projectNotFound: 'Project not found',
  todoNotFound: 'Todo not found',
  internal: 'Internal server error',
  invalidParams: 'Invalid parameters',
  requestFailed: 'Request failed ({{status}})',
  iconRequired: 'Please choose an icon',
  iconInvalid: 'Invalid icon format',
  projectNameRequired: 'Project name is required',
  titleRequired: 'Title is required',
  descriptionRequired: 'Original description is required',
  messageRequired: 'Message cannot be empty',
  aiNotConfigured: 'Configure the AI service in Settings first (Base URL / API Key / model)',
  chatInProgress: 'A conversation is already running for this Todo. Wait for it to finish or stop it, then retry',
  chatAborted: 'Conversation aborted',
  aiCallFailed: 'AI request failed',
  aiHttpError: 'AI service returned HTTP {{status}}: {{body}}',
  aiTimeout: 'AI response timed out (no data for {{seconds}}s)',
  aiEmptyContent: 'AI returned no valid content',
  connectionFailed: 'Connection failed',
  noConfirmedTasks: 'No confirmed tasks yet',
  todoNotConfirmable: 'The requirement cannot be confirmed yet. Wait for the AI to finish its analysis',
};

export const ERROR_MESSAGES: Record<Locale, Record<ErrorKey, string>> = { zh: zhErrors, en: enErrors };

export function isErrorKey(value: string): value is ErrorKey {
  return Object.hasOwn(zhErrors, value);
}

export function formatMessage(locale: Locale, key: ErrorKey, params?: MessageParams): string {
  const template = ERROR_MESSAGES[locale][key];
  return params ? template.replace(/\{\{(\w+)\}\}/g, (m, name) => String(params[name] ?? m)) : template;
}

const zodErrorMaps = { zh: z.locales.zhCN().localeError, en: z.locales.en().localeError };

export type LocalizedParseResult<T> = { success: true; data: T } | { success: false; message: string };

/** Schema messages are ErrorKeys; checks without a custom message use zod's built-in locale. */
export function parseWithLocale<S extends ZodType>(
  schema: S,
  data: unknown,
  locale: Locale,
): LocalizedParseResult<z.output<S>> {
  const result = schema.safeParse(data, { error: zodErrorMaps[locale] });
  if (result.success) return { success: true, data: result.data };
  const message = result.error.issues[0]?.message;
  if (!message) return { success: false, message: formatMessage(locale, 'invalidParams') };
  return { success: false, message: isErrorKey(message) ? formatMessage(locale, message) : message };
}
