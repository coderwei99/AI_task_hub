import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, HardDrive, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { aiSettingsSchema, parseWithLocale } from '@ai-task-hub/shared';
import { currentLocale } from '@/i18n';
import {
  useSettings,
  useStorageInfo,
  useTestConnection,
  useUpdateSettings,
  type TestConnectionResult,
} from '@/api/hooks';
import { PageError } from '@/components/PageError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isPending, error: loadError, refetch } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestConnection();

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.baseUrl);
      setModel(settings.model);
    }
  }, [settings]);

  function validate() {
    const parsed = parseWithLocale(aiSettingsSchema, { baseUrl, apiKey, model }, currentLocale());
    if (!parsed.success) {
      setError(parsed.message);
      return null;
    }
    setError('');
    return parsed.data;
  }

  async function handleSave() {
    const data = validate();
    if (!data) return;
    try {
      await updateSettings.mutateAsync(data);
      setApiKey((current) => (current.trim() === data.apiKey ? '' : current));
      toast.success(t('settings.saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.saveFailed'));
    }
  }

  async function handleTest() {
    const data = validate();
    if (!data) return;
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync(data);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        ok: false,
        latencyMs: 0,
        error: e instanceof Error ? e.message : t('settings.testFailed'),
      });
    }
  }

  return (
    <div className="max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">{t('settings.title')}</h1>

      <Card className="p-5">
        <h2 className="text-base font-semibold">{t('settings.aiTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('settings.aiDesc')}</p>

        {isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : loadError ? (
          <PageError message={t('settings.loadFailed')} onRetry={() => refetch()} />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBaseUrl('https://api.openai.com/v1');
                  setModel('gpt-4o-mini');
                  setApiKey('');
                  setTestResult(null);
                  setError('');
                }}
              >
                {t('settings.openAiPreset')}
              </Button>
              <a
                className="text-sm text-primary underline underline-offset-4"
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
              >
                {t('settings.openAiKeyLink')}
              </a>
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="api-key">API Key</Label>
                {settings?.hasApiKey ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    <CheckCircle2 aria-hidden="true" />
                    {t('settings.keySaved')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t('settings.keyNotSaved')}</Badge>
                )}
              </div>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                aria-describedby="api-key-hint"
                autoComplete="off"
              />
              <p id="api-key-hint" className="text-xs text-muted-foreground">
                {t(settings?.hasApiKey ? 'settings.savedKeyHint' : 'settings.apiKeyHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">{t('settings.model')}</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {testResult && (
              <div
                className={
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
                  (testResult.ok
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300')
                }
              >
                {testResult.ok ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {testResult.ok
                  ? t('settings.testOk', { ms: testResult.latencyMs })
                  : t('settings.testError', {
                      error: testResult.error ?? t('settings.unknownError'),
                    })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
                {testConnection.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> {t('settings.testing')}
                  </>
                ) : (
                  t('settings.test')
                )}
              </Button>
              <Button onClick={handleSave} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <StorageCard />
    </div>
  );
}

function StorageCard() {
  const { t } = useTranslation();
  const { data: storage } = useStorageInfo();

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      toast.success(t('settings.pathCopied'));
    } catch {
      toast.error(t('copy.failed'));
    }
  }

  const rows = storage
    ? [
        { label: t('settings.dataDir'), path: storage.dataDir },
        { label: t('settings.dbFile'), path: storage.dbPath },
      ]
    : [];

  return (
    <Card className="mt-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <HardDrive className="size-4" /> {t('settings.dataTitle')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('settings.dataDesc')}</p>
      <div className="mt-4 space-y-3">
        {rows.map(({ label, path }) => (
          <div key={label} className="space-y-1.5">
            <p className="text-sm font-medium">{label}</p>
            <div className="flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs"
                title={path}
              >
                {path}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t('settings.copyPath')}
                title={t('settings.copyPath')}
                onClick={() => copyPath(path)}
              >
                <Copy />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>{t('settings.backup')}</p>
        <p>{t('settings.envHint')}</p>
      </div>
    </Card>
  );
}
