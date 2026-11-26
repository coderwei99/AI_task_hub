import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function withServer(dataDir, check) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', '--production'], {
    cwd: new URL('../server/', import.meta.url),
    env: { ...process.env, AI_TASK_HUB_DATA_DIR: dataDir, AI_TASK_HUB_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close').catch(() => {});
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error(output || 'Startup timed out')), 15000);
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`Server exited (${code})\n${output}`)));
      child.stderr.on('data', (chunk) => (output += chunk));
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const address = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (address) resolve(address);
      });
      child.once('close', () => clearTimeout(timeout));
    });
    await check(url);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  }
}
