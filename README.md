# AI Task Hub

本地单机的「需求打磨 + 任务管理」工作台，面向独立开发者：把模糊想法经过 AI 多轮澄清，变成一份可交付给本地 Coding Agent 的 Markdown 需求文档。

核心流程：**模糊想法 → AI 多轮澄清 → 用户手动确认 → Copy Markdown 交给 Coding Agent**。

> 重要规则：AI 只判断需求是否充分，**永远不会自动确认**。确认权始终在用户手里；已确认的需求一旦被修改，会回到「需重新确认」状态。本产品不执行任何代码。

## 目录结构

```
shared/   共享类型 / 枚举 / zod schema / 状态机 / Markdown 模板
server/   Hono API + SQLite(Drizzle) + AI 流式客户端
web/      React + Vite + Tailwind + shadcn/ui 前端
```

## 启动

环境要求：Node.js >= 22、pnpm >= 10。

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

- 前端：http://localhost:5173（Vite 热更新）
- API：http://127.0.0.1:8787

### 生产模式（单进程托管）

```bash
pnpm build   # 构建 web 到 web/dist
pnpm start   # server 同时托管 API 与前端静态资源
```

访问 http://127.0.0.1:8787。启动时自动执行数据库 migration，无需手动建表。

## 配置

### AI 服务（必需，否则无法澄清）

打开 web「设置」页，填写三项（OpenAI 兼容接口）：

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| Base URL | 兼容 `/chat/completions` 的地址 | `https://api.openai.com/v1` |
| API Key | 密钥 | `sk-...` |
| Model | 模型名 | `gpt-4o-mini` |

填完点「测试连接」验证可用性。配置保存在本地 SQLite 中。

> 安全说明：API Key 以明文存于本地数据库（单机设计的取舍），输入框为密码类型，服务端日志不会打印 Key。请勿把数据目录提交到 git 或分享给他人。

### 数据目录（可选）

默认数据目录为 `~/.ai-task-hub`。可用环境变量覆盖：

```bash
AI_TASK_HUB_DATA_DIR=/path/to/dir pnpm start
```

## 数据与备份

所有数据（项目 / Todo / 对话 / 活动记录 / 设置）都在一个 SQLite 文件里：

```
~/.ai-task-hub/data.db        # 主库
~/.ai-task-hub/data.db-wal    # WAL 日志
~/.ai-task-hub/data.db-shm    # WAL 共享内存
```

数据库运行在 WAL 模式。

### 备份

最稳妥的方式是**先停止服务**再复制整个数据目录：

```bash
cp -R ~/.ai-task-hub ~/backup/ai-task-hub-$(date +%Y%m%d)
```

不停机备份请使用 SQLite 在线备份（避免只拷主库而丢失 WAL 中未落盘的数据）：

```bash
sqlite3 ~/.ai-task-hub/data.db ".backup '/path/to/backup.db'"
```

### 恢复

停止服务后，把备份的 `data.db`（及 `-wal`/`-shm`，若存在）放回数据目录，再启动即可；启动时会自动补齐 migration。

## 测试与检查

```bash
pnpm -r test        # shared + server 单元/集成测试
pnpm typecheck      # 全包类型检查
```

## 状态机（需求状态）

`待打磨 → 打磨中 → AI 已完成分析 → 已确认`；已确认后编辑文档 → `需重新确认` → 再次确认 → `已确认`；已确认后继续对话 → 回到 `打磨中`。

不变量：`已确认` 只能由用户确认动作到达，AI 的任何输出都不能直接产生 `已确认`（有单测覆盖）。