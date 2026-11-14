import 'i18next';
import type { Messages } from './locales/zh';
import type { ErrorKey } from '@ai-task-hub/shared';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: Messages;
      errors: Record<ErrorKey, string>;
    };
  }
}
