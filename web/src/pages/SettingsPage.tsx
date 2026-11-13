import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { aiSettingsSchema } from '@ai-task-hub/shared';
import { useSettings, useTestConnection, useUpdateSettings, type TestConnectionResult } from '@/api/hooks';
import { PageError } from '@/components/PageError';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
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
      setApiKey(settings.apiKey);
      setModel(settings.model);
    }
  }, [settings]);

  function validate() {
    const parsed = aiSettingsSchema.safeParse({ baseUrl, apiKey, model });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '参数错误');
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
      toast.success('配置已保存');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
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
      setTestResult({ ok: false, latencyMs: 0, error: e instanceof Error ? e.message : '测试失败' });
    }
  }

  return (
    <div className="max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">设置</h1>

      <Card className="p-5">
        <h2 className="text-base font-semibold">AI 模型配置</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          兼容 OpenAI Chat Completions 接口。需求内容会发送到你配置的 AI 服务，请使用你信任的服务商。
        </p>

        {isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">加载中…</p>
        ) : loadError ? (
          <PageError message="配置加载失败" onRetry={() => refetch()} />
        ) : (
          <div className="mt-4 space-y-4">
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
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">仅保存在本地 SQLite，不会上传到任何第三方。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {testResult && (
              <div
                className={
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
                  (testResult.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700')
                }
              >
                {testResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {testResult.ok ? `连接成功 · ${testResult.latencyMs}ms` : `连接失败：${testResult.error ?? '未知错误'}`}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
                {testConnection.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> 测试中…
                  </>
                ) : (
                  '测试连接'
                )}
              </Button>
              <Button onClick={handleSave} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">数据</h2>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p>
            数据库位置：<code className="rounded bg-muted px-1.5 py-0.5 text-xs">~/.ai-task-hub/data.db</code>
          </p>
          <p>备份方式：复制上述文件即可。</p>
        </div>
      </Card>
    </div>
  );
}