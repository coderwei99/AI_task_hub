import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ERROR_MESSAGES, matchLocale, type Locale } from '@ai-task-hub/shared';
import { zh } from './locales/zh';
import { en } from './locales/en';

const STORAGE_KEY = 'ai-task-hub-lang';

export const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

function initialLocale(): Locale {
  return matchLocale(localStorage.getItem(STORAGE_KEY) ?? '') ?? matchLocale(navigator.language) ?? 'en';
}

function syncHtmlLang(lng: string) {
  document.documentElement.lang = lng === 'zh' ? 'zh-CN' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh, errors: ERROR_MESSAGES.zh },
    en: { translation: en, errors: ERROR_MESSAGES.en },
  },
  lng: initialLocale(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export function currentLocale(): Locale {
  return matchLocale(i18n.language) ?? 'zh';
}

export function setLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
}

export default i18n;
