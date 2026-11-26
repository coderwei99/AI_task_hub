# AI Task Hub

English · [简体中文](README.zh-CN.md)

AI Task Hub is a local workspace for independent developers to refine requirements and manage tasks. Turn a rough idea into a Markdown specification through a conversation with AI, review and confirm it yourself, then hand it off to a coding agent.

- Organize work by project and search tasks by title or task number. Combine filters for project, requirement status, and execution status.
- Import a Markdown file as a draft, refine it through chat, and compare or restore document versions.
- Copy or download a task as Markdown, or export all confirmed requirements in a project.

## Quick start

Install Node.js 22 or later and pnpm 10. The repository pins the pnpm version in [package.json](package.json).

```bash
git clone https://github.com/coderwei99/AI_task_hub.git
cd AI_task_hub
pnpm install
pnpm build
pnpm start
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). The server serves both the web app and the API and applies SQLite migrations automatically. Set `AI_TASK_HUB_PORT` to change the production port.

For development, run `pnpm dev` after installing dependencies. The Vite frontend runs at [http://localhost:5173](http://localhost:5173), and the API runs at [http://127.0.0.1:8787](http://127.0.0.1:8787).

## Configure an AI provider

Open **Settings** to enable AI chat. Choose the OpenAI preset or enter the settings for another provider that supports streaming OpenAI-compatible Chat Completions.

| Field    | Description                                        | Example                     |
| -------- | -------------------------------------------------- | --------------------------- |
| Base URL | API base URL. The app appends `/chat/completions`. | `https://api.openai.com/v1` |
| API Key  | The key issued by your provider                    | `sk-...`                    |
| Model    | The provider's model identifier                    | `gpt-4o-mini`               |

Select **Test connection** to verify streaming, then save the configuration. Leave the key field blank to reuse a saved key with the same Base URL. Enter a key when switching to a different Base URL.

The server stores the key in plaintext in the local SQLite database. The settings API reports whether a key is saved. AI requests use the key to authenticate with your configured provider and send project context, the current requirements document, and relevant chat messages. Keep the data directory private.

## Requirements workflow

A requirement can move from **Pending** to **Refining** to **AI ready**. Only you can confirm it. You can also confirm a nonempty draft before the AI considers it ready, once generation has stopped. Editing a confirmed document requires confirmation again. Continuing the conversation on a confirmed requirement moves it back to **Refining**.

The full chat history stays in SQLite. Model requests include project context, the current document, the latest user turn, and recent history within the configured budget. Both normal and repair requests keep up to eight user turns by default, including the current turn. The input budget is estimated at about 24,000 tokens from UTF-8 byte counts. The output limit is 4,096 tokens. Required context can exceed the estimated input budget. See the defaults in [context.ts](server/src/ai/context.ts).

For standard seven-section documents, the model can return only the sections that changed. A turn can also leave the document unchanged. Keep important decisions in the document so they remain available after earlier chat messages fall outside the context window.

## Data and backups

Projects, tasks, conversations, activity, and settings are stored locally in `~/.ai-task-hub/data.db`. Set `AI_TASK_HUB_DATA_DIR` before starting the server to use another directory. SQLite uses write-ahead logging and may create `data.db-wal` and `data.db-shm` alongside the main file.

For an offline backup, stop the server and copy the entire data directory. For a backup while the server is running, use SQLite's online backup command.

```bash
sqlite3 ~/.ai-task-hub/data.db ".backup '/path/to/backup.db'"
```

To restore, stop the server and replace the data directory with the offline copy, or restore the online backup as `data.db` in an empty data directory. Start the server to apply any pending migrations.

## Repository layout

| Directory | Contents                                                         |
| --------- | ---------------------------------------------------------------- |
| `shared/` | Shared types, Zod schemas, state machine, and Markdown templates |
| `server/` | Hono API, SQLite with Drizzle, and streaming AI client           |
| `web/`    | React, Vite, Tailwind CSS, and shadcn/ui                         |

## Tests and checks

```bash
pnpm -r test
pnpm typecheck
pnpm build
pnpm test:startup
pnpm exec playwright install chromium
pnpm test:e2e
```

Startup tests use the production build and check fresh databases and migrations. Browser tests use a mock AI provider. See the [contribution guide](CONTRIBUTING.md) for repository conventions.

## License

[MIT](LICENSE)
