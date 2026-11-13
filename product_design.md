# AI Task Hub — 产品设计文档

> 版本：v1.1（2026-11-13，评审修订 D1/D3/D4/D8）
> 上游文档：[task_plan.md](./task_plan.md)（PRD）
> 状态：待评审。评审通过后进入 UI 原型与开发。

---

## 一、概述与技术决策

### 1.1 产品一句话

面向独立开发者的本地单机工作台：**模糊想法 → AI 多轮澄清 → 用户手动确认 → Markdown 交付给本地 Coding Agent**。

### 1.2 已确认的技术决策

| 决策项 | 结论 | 说明 |
| --- | --- | --- |
| 前端框架 | React 19 + TypeScript + Vite | PRD 建议方案，AI 辅助编码生态最好 |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react | 低饱和度、紧凑布局，贴合 It's a Plan 视觉方向 |
| 后端 | Node.js（≥22）+ Hono | 轻量、TypeScript 原生、SSE 支持好 |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM | 本地单机零运维；Drizzle 同时支持 PG，未来可迁移 |
| AI 接入 | OpenAI 兼容 Chat Completions API | 用户在设置页自定义 Base URL / API Key / 模型 |
| 运行形态 | 本地单机、单用户、无登录 | 服务仅绑定 `127.0.0.1` |
| 认证 | 不做 | 单用户本地工具，无协作需求 |

### 1.3 本文档在 PRD 之外补充的设计决策

以下决策 PRD 未明确，本文档给出方案。v1.1 评审修订了 D1/D3/D4/D8，其余保留：

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 看板提供「需求状态 / 执行状态」双视图，默认需求状态视图；两视图默认隐藏已完成任务，可开关显示 | 两个状态独立管理；避免「已确认」列无限堆积历史任务 |
| D2 | 需求状态视图**禁止拖拽**；执行状态视图允许拖拽 | 守住「确认必须发生在详情页」的核心规则 |
| D3 | 需求文档由 AI **每轮全量重写**，用户可手动编辑；prompt 硬约束保护用户编辑，支持一级回退 | 单一事实来源；护栏防止 AI 覆盖用户手动编辑 |
| D4 | AI 单次流式回复 = 对话正文 + 分隔符 + 完整文档 + 充分性标记；解析失败自动 JSON mode 补救调用 | 一次调用产出对话与文档；补救避免弱模型下核心流程死锁 |
| D5 | Todo 级 Copy 附带精简项目上下文（技术栈/公共约束） | 复制结果可独立交给 Coding Agent，无需再补背景 |
| D6 | 「全部任务」页 MVP 用跨项目列表，不做聚合看板 | PRD 要求先做好 Board + 详情，列表成本最低 |
| D7 | 已确认状态下继续对话 → 回到「打磨中」；直接编辑文档 → 「需重新确认」 | 区分「重新打磨」与「小幅修订」两种路径 |
| D8 | 每个项目内 Todo 有自增编号，展示为 `TASK-001`；`projects.todoSeq` 单调计数器，编号永不复用 | 对齐 PRD 编号；避免删除后编号复用导致引用错乱 |

---

## 二、整体架构与工程结构

### 2.1 运行架构

```
┌────────────────────────── 浏览器（localhost:5173）──────────────────────────┐
│  React SPA                                                                │
│  React Router · TanStack Query（服务端状态）· shadcn/ui                     │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ /api/*（dev 由 Vite proxy 转发；prod 同进程托管静态文件）
┌──────────────▼────────────────────────────────────────────────────────────┐
│  Hono API Server（127.0.0.1:8787）                                         │
│  ├─ REST：项目 / Todo / 活动 / 设置 / 导出                                   │
│  ├─ SSE：AI 对话流式转发 + 分隔符解析 + 状态机                                │
│  └─ Drizzle ORM ──► SQLite 文件（~/.ai-task-hub/data.db，WAL 模式）          │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ HTTPS（用户配置的 Base URL）
        ┌──────▼──────┐
        │ OpenAI 兼容  │
        │ 模型服务     │
        └─────────────┘
```

- **开发**：`pnpm dev` 并发启动 Vite（5173）与 API（8787），Vite 代理 `/api`。
- **生产/日常使用**：`pnpm build && pnpm start`，Hono 单进程托管构建产物 + API，浏览器打开 `http://127.0.0.1:8787`。
- **数据位置**：默认 `~/.ai-task-hub/data.db`，可用环境变量 `AI_TASK_HUB_DATA_DIR` 覆盖。备份 = 复制该文件。

### 2.2 仓库结构（pnpm workspace）

```
AI_task_hub/
├─ package.json
├─ pnpm-workspace.yaml
├─ shared/                  # 前后端共享，杜绝类型漂移
│  └─ src/
│     ├─ types.ts           # Project / Todo / Message / Activity / 枚举
│     ├─ schemas.ts         # zod 校验（API 入参、设置、AI 输出）
│     ├─ state-machine.ts   # 需求状态流转规则（纯函数，前后端共用）
│     └─ markdown.ts        # Todo / Project 导出模板（纯函数）
├─ server/
│  └─ src/
│     ├─ index.ts           # Hono 入口、静态托管、端口绑定
│     ├─ db/
│     │  ├─ schema.ts       # Drizzle 表定义
│     │  └─ migrations/     # drizzle-kit 生成
│     ├─ routes/            # projects / todos / chat / settings / export
│     ├─ ai/
│     │  ├─ prompt.ts       # System Prompt 组装
│     │  ├─ stream.ts       # 上游流式调用 + 分隔符解析
│     │  └─ client.ts       # OpenAI 兼容客户端（fetch）
│     └─ services/          # 状态机落地、活动记录、编号生成
└─ web/
   └─ src/
      ├─ main.tsx / router.tsx
      ├─ api/               # fetch 封装 + TanStack Query hooks
      ├─ components/        # ui/（shadcn）+ 业务组件
      ├─ pages/
      │  ├─ ProjectsPage.tsx
      │  ├─ BoardPage.tsx
      │  ├─ TodoDetailPage.tsx
      │  ├─ AllTasksPage.tsx
      │  └─ SettingsPage.tsx
      └─ lib/               # 工具、SSE 解析、clipboard
```

### 2.3 前端关键依赖

| 用途 | 选型 |
| --- | --- |
| 路由 | React Router v7（library mode） |
| 服务端状态 | TanStack Query v5 |
| 看板拖拽 | dnd-kit |
| Markdown 渲染 | react-markdown + remark-gfm |
| 表单校验 | react-hook-form + zod（复用 shared/schemas） |
| 单元测试 | Vitest |

---

## 三、信息架构与路由

### 3.1 路由表

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | — | 重定向到 `/projects` |
| `/projects` | 项目列表页 | 全部项目卡片 + 新建入口 |
| `/projects/:projectId` | 项目看板页 | 默认需求状态视图，可切换执行状态视图 |
| `/projects/:projectId/todos/:todoId` | Todo 详情页 | 三区域：AI 对话 / 需求文档 / 活动记录 |
| `/tasks` | 全部任务页 | 跨项目列表（D6） |
| `/settings` | 设置页 | AI 模型配置、数据信息 |
| `*` | 404 | 简洁空态 + 返回项目列表 |

### 3.2 全局布局（AppShell）

```
┌────────────┬──────────────────────────────────────────────────┐
│ 侧边导航    │  主内容区（路由出口）                               │
│            │                                                  │
│ ⌂ 全部任务  │                                                  │
│            │                                                  │
│ 我的项目    │                                                  │
│  💬 小美客服 │                                                  │
│  ✍ 个人博客 │                                                  │
│  🧩 AI Hub │                                                  │
│  ＋ 新建项目 │                                                  │
│            │                                                  │
│ ⚙ 设置     │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

- 侧边栏固定宽 240px，项目行展示 icon + 名称 + 「待打磨数」徽标（>0 时显示）。
- 当前项目高亮；侧边栏在详情页保持可见，保证随时切换项目。
- 移动端（<768px）：侧边栏收进抽屉，详情页三区域改为顶部 Tab 切换。MVP 以桌面为主，移动端仅保证可用。

---

## 四、页面设计

### 4.1 项目列表页 `/projects`

```
┌──────────────────────────────────────────────────────────────┐
│ 我的项目                                      [＋ 新建项目]    │
│                                                              │
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│ │ 💬 小美客服       │ │ ✍ 个人博客        │ │ 🧩 AI Task Hub │ │
│ │ Vue2 客服系统…    │ │ 静态博客重构…     │ │ 本项目自身…     │ │
│ │                  │ │                  │ │                │ │
│ │ 任务 12          │ │ 任务 4           │ │ 任务 7         │ │
│ │ 待打磨 3 · 已确认 5│ │ 待打磨 1 · 已确认 2│ │ 待打磨 2 · 已确认 3│ │
│ │ 更新于 2 小时前   │ │ 更新于昨天        │ │ 更新于 3 天前   │ │
│ └──────────────────┘ └──────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- 卡片网格：桌面 3 列，随宽度自适应。
- 点击卡片 → 项目看板。卡片右上角 `⋯` 菜单：编辑、删除（二次确认，提示将删除项目下全部 Todo）。
- **新建/编辑项目弹窗**字段：名称*、icon（emoji 选择器，默认 📁）、描述、技术栈、公共约束（多行文本）。
- 空态：插画 + 「创建第一个项目」按钮。

### 4.2 项目看板页 `/projects/:projectId`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 💬 小美客服                                          [⧉ Copy 项目] [＋ 新建 Todo] │
│ Vue2 客服系统，含管理端与访客端…                                            │
│ 待打磨 3 · 打磨中 1 · 已确认 5    视图：[需求状态|执行状态] [ ]显示已完成 🔍(P1) │
├──────────────────────────────────────────────────────────────────────────┤
│ 待打磨 3      │ 打磨中 1      │ AI 已完成分析 2 │ 已确认 5      │ 需重新确认 0 │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐  │ ┌──────────┐  │            │
│ │TASK-004  │ │ │TASK-002  │ │ │TASK-001  │  │ │TASK-003  │  │   空态     │
│ │优化消息加 │ │ │优化 AI 流 │ │ │消息已读回 │  │ │会话转接  │  │            │
│ │载速度     │ │ │式渲染     │ │ │执        │  │ │          │  │            │
│ │🔴高 ·待执行│ │ │🟡中 ·待执行│ │ │🟢低 ·进行中│  │ │🟡中 ·已完成│  │            │
│ │2小时前 ⧉ │ │ │昨天 ⧉    │ │ │3天前 ⧉   │  │ │上周 ⧉    │  │            │
│ └──────────┘ │ └──────────┘ │ └──────────┘  │ └──────────┘  │            │
└──────────────────────────────────────────────────────────────────────────┘
```

**卡片内容**：`TASK-编号`、标题（最多 2 行）、优先级徽标（🔴高/🟡中/🟢低）、另一维度的状态徽标（需求视图下显示执行状态，反之亦然）、相对更新时间、hover 显示 Copy 按钮（⧉）。

**交互规则**：

| 交互 | 行为 |
| --- | --- |
| 点击卡片 | 进入 Todo 详情页 |
| 卡片 ⧉ | 复制该 Todo 的完整 Markdown（任意需求状态均可复制，未确认时复制内容顶部标注「⚠ 未确认」） |
| 视图切换 | 需求状态 ⇄ 执行状态，列随之切换；选择记忆在 localStorage |
| 显示已完成开关 | 默认关闭：两视图均隐藏 `executionStatus = done` 的任务；打开后显示。列头计数只统计可见卡片；选择记忆在 localStorage |
| 拖拽（仅执行视图） | 改变执行状态，乐观更新 + 失败回滚，写入活动记录 |
| 拖拽（需求视图） | 禁用（D2），卡片无拖拽手柄 |
| Copy 项目 | 导出全部**已确认** Todo + 项目上下文；已确认数为 0 时按钮禁用并 tooltip 说明 |
| 新建 Todo | 弹窗：标题*、原始描述*、优先级（默认中）→ 创建后直接跳转详情页 |

- 列头显示状态名 + 可见数量；每列独立滚动，空列显示浅色空态文案。
- 搜索/筛选（优先级、标签）为 P1，MVP 不做。

### 4.3 Todo 详情页（核心页面）

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 小美客服 / TASK-001                                    [⧉ Copy] [✓ 确认需求] │
│ 优化消息加载速度                                                              │
│ [AI 已完成分析]  执行状态：[待执行 ▾]  优先级：[🔴 高 ▾]                         │
├────────────────────────────────────┬─────────────────────────────────────┤
│ AI 对话                             │ [需求文档] [活动记录]                   │
│                                    │                                     │
│ 🤖 AI                              │ # 需求背景                           │
│ 我已理解你的优化目标。还需确认一个     │ 会话列表首次加载耗时 2s+…             │
│ 问题：首次加载是否允许先展示本地消息？  │                                     │
│                                    │ # 需求目标                           │
│ 🧑 你                              │ 首屏可交互时间 < 500ms…              │
│ 可以，优先展示本地已有消息。           │                                     │
│                                    │ # 功能范围                           │
│ 🤖 AI                              │ …                                   │
│ 明白，已纳入需求。检查了其他约束，     │                                     │
│ 没有发现明显遗漏。                    │ # 技术约束 / 验收标准 / 排除范围 /     │
│                                    │ 尚未解决的问题                        │
│ ┌────────────────────────────────┐ │                                     │
│ │ AI 已完成分析，等待你确认需求     │ │              [↩ 回退上一版] [✎ 编辑文档] │
│ └────────────────────────────────┘ │                                     │
│ [继续补充需求或回答 AI 的问题…    ]   │                                     │
│                            [发送]  │                                     │
└────────────────────────────────────┴─────────────────────────────────────┘
```

**布局**：左右分栏，左 55% 对话区、右 45% 文档/活动 Tab。两栏各自独立滚动。

**顶部操作区**：

| 元素 | 规则 |
| --- | --- |
| 标题 | 点击行内编辑，失焦保存；改标题不影响需求状态 |
| 需求状态徽标 | 只读展示（颜色区分五态），不可点击修改 |
| 执行状态下拉 | 五种状态任意切换，写入活动记录 |
| 优先级下拉 | 高/中/低 |
| ✓ 确认需求 | 仅 `AI 已完成分析`、`需重新确认` 两态可点；其余禁用 + tooltip「AI 完成分析后可确认」。点击后二次确认弹窗展示文档摘要 → 状态变 `已确认`，记录 `confirmed_at` 与活动 |
| ⧉ Copy | 复制完整 Markdown（同卡片规则） |
| ⋯ 菜单 | 删除 Todo（二次确认） |

**AI 对话区**：

- 消息气泡：AI 左 / 用户右，Markdown 渲染；AI 消息流式逐字出现。
- 流式中：输入框禁用，发送按钮变为「停止」；点击停止 → 中断流，**不保存**半截 AI 回复，用户消息保留，状态停留 `打磨中`。
- 状态横幅（输入框上方）：
  - `打磨中` → 「AI 正在帮你完善需求…」
  - `AI 已完成分析` → 「AI 认为需求已充分，请查看右侧文档后确认」+ 快捷「确认需求」按钮
  - `已确认` → 「需求已确认，可 Copy 交给 Coding Agent」
- 发送消息触发状态流转（见第六节），AI 回复结束后右侧文档自动刷新。

**需求文档 Tab**：

- 渲染 `requirement_doc`（Markdown，固定七节结构，见第九节）。
- 「编辑文档」→ 切换为 Markdown 源码编辑（textarea + 预览切换），保存走 PATCH 接口；若当前 `已确认` → 自动转 `需重新确认`（D7）。
- AI 每轮全量重写文档（D3）；用户手动编辑的内容会作为下一轮 AI 的输入上下文，且 prompt 硬约束要求 AI 不得擅自改写（见 7.3）。
- 「回退上一版」：取最近一条 `doc_updated` 活动的 `prevDoc`，走同一 PATCH 接口（状态副作用规则相同）；仅存在上一版时显示。完整版本历史为 P1。

**活动记录 Tab**：时间线，新→旧，图标 + 文案 + 相对时间。事件类型见 5.4。

### 4.4 全部任务页 `/tasks`

- 跨项目表格：编号+标题 / 所属项目 / 需求状态 / 执行状态 / 优先级 / 更新时间。
- 默认按更新时间倒序；点击行 → 详情页。
- 顶部统计 chips：全部 n · 待打磨 n · 已确认 n。
- 筛选（项目/状态）P1。

### 4.5 设置页 `/settings`

```
AI 模型配置
  Base URL   [https://api.openai.com/v1        ]
  API Key    [••••••••••••••••••••••••         ]
  模型       [gpt-4o-mini                      ]
  [测试连接]  [保存]

数据
  数据库位置：~/.ai-task-hub/data.db
  备份方式：复制上述文件即可（一键导出 P1）
```

- 「测试连接」：用当前表单值发一次最小 completion 请求，展示成功/失败原因（不入库）。
- API Key 仅存本地 SQLite，输入框 type=password；服务端日志不打印 Key。
- 未配置 AI 时：详情页对话区显示引导空态「请先在设置中配置 AI 模型」+ 跳转按钮；其余功能不受影响。
- 隐私提示文案：需求内容会发送到你配置的 AI 服务，请使用你信任的服务商。

---

## 五、数据模型

### 5.1 ER 关系

```
projects 1 ── n todos 1 ── n messages
                    1 ── n activities
settings（KV，独立）
```

### 5.2 表定义（Drizzle / SQLite）

```ts
// projects
{
  id:          text PK,            // nanoid
  name:        text NOT NULL,
  icon:        text NOT NULL DEFAULT '📁',   // emoji
  description: text NOT NULL DEFAULT '',
  techStack:   text NOT NULL DEFAULT '',     // 技术栈描述
  constraints: text NOT NULL DEFAULT '',     // 公共约束（架构/规范）
  todoSeq:     integer NOT NULL DEFAULT 0,   // Todo 编号单调计数器，只增不减
  createdAt:   integer NOT NULL,             // unix ms，下同
  updatedAt:   integer NOT NULL,
}

// todos
{
  id:                 text PK,      // nanoid
  projectId:          text NOT NULL FK → projects.id ON DELETE CASCADE,
  number:             integer NOT NULL,      // 项目内自增，展示 TASK-001
  title:              text NOT NULL,
  originalDescription:text NOT NULL,         // 用户最初输入，永不改写
  requirementDoc:     text NOT NULL DEFAULT '',  // AI 整理的 Markdown（七节）
  requirementStatus:  text NOT NULL DEFAULT 'pending',   // 见 5.3
  executionStatus:    text NOT NULL DEFAULT 'todo',      // 见 5.3
  priority:           text NOT NULL DEFAULT 'medium',    // high|medium|low
  confirmedAt:        integer,               // 最近一次确认时间，可空
  createdAt:          integer NOT NULL,
  updatedAt:          integer NOT NULL,
  // UNIQUE(projectId, number)
}

// messages
{
  id:        text PK,
  todoId:    text NOT NULL FK → todos.id ON DELETE CASCADE,
  role:      text NOT NULL,        // 'user' | 'assistant'（system 不落库）
  content:   text NOT NULL,        // assistant 只存对话正文，不含文档块
  createdAt: integer NOT NULL,
}

// activities
{
  id:        text PK,
  todoId:    text NOT NULL FK → todos.id ON DELETE CASCADE,
  type:      text NOT NULL,        // 见 5.4
  payload:   text NOT NULL DEFAULT '{}',  // JSON：{from,to,source,reason…}
  createdAt: integer NOT NULL,
}

// settings（KV）
{ key: text PK, value: text NOT NULL }
// 已知 key：ai_base_url / ai_api_key / ai_model
```

**编号生成**：创建 Todo 时在事务内将 `projects.todoSeq + 1` 写回并作为新 Todo 的 `number`。计数器只增不减，编号**永不复用**（删除最大编号后新建会得到新编号，允许空洞）。SQLite 单写者，无并发冲突。

**索引**：`todos(projectId)`、`messages(todoId, createdAt)`、`activities(todoId, createdAt)`。

### 5.3 枚举（shared/types.ts，前后端唯一来源）

```ts
export const REQUIREMENT_STATUSES = ['pending','polishing','ai_ready','confirmed','reconfirm'] as const;
// 待打磨 / 打磨中 / AI 已完成分析 / 已确认 / 需重新确认

export const EXECUTION_STATUSES = ['todo','in_progress','review','done','paused'] as const;
// 待执行 / 进行中 / 待验收 / 已完成 / 已暂停

export const PRIORITIES = ['high','medium','low'] as const;
```

### 5.4 活动事件类型

| type | payload | 触发 |
| --- | --- | --- |
| `todo_created` | — | 创建 Todo |
| `requirement_status_changed` | `{from, to, reason}` | 需求状态任意流转（reason：`chat` / `ai_sufficient` / `user_confirm` / `doc_edit`） |
| `execution_status_changed` | `{from, to}` | 下拉/拖拽修改执行状态 |
| `doc_updated` | `{source: 'ai' \| 'user', prevDoc}` | 需求文档内容变化；`prevDoc` 存上一版全文，供一级回退 |
| `confirmed` | — | 用户点击确认（与 status_changed 同时记录，便于时间线突出显示） |

不记录：Copy 导出、标题/优先级修改（噪音大于价值）。

---

## 六、状态机与流转规则

### 6.1 需求状态机（核心）

```
                 用户发消息                AI 标记充分
   ┌─────────┐ ───────────► ┌──────────┐ ───────────► ┌──────────┐
   │ pending │              │ polishing│              │ ai_ready │
   │ 待打磨   │              │ 打磨中    │ ◄─────────── │ AI已完成  │
   └─────────┘              └──────────┘   用户发消息   └────┬─────┘
                                 ▲                          │ 用户点击确认
                                 │ 用户发消息                ▼
                                 │                    ┌──────────┐
                                 │                    │ confirmed│
                                 │                    │ 已确认    │
                                 │                    └────┬─────┘
                                 │                         │ 用户直接编辑文档
                                 │                         ▼
                                 │    用户发消息      ┌──────────┐
                                 └────────────────── │ reconfirm│
                                      用户点击确认 ───► │ 需重新确认│
                                 （reconfirm → confirmed）└──────────┘
```

**完整转换表**（`shared/state-machine.ts` 实现为纯函数，服务端唯一执行点）：

| 当前状态 | 触发事件 | 下一状态 | 执行者 |
| --- | --- | --- | --- |
| pending | 用户发送消息 | polishing | 系统 |
| polishing | AI 输出 `SUFFICIENT: YES` | ai_ready | 系统（AI 判断） |
| polishing | AI 输出 `SUFFICIENT: NO` | polishing（不变） | — |
| ai_ready | 用户发送消息 | polishing | 系统 |
| ai_ready | 用户点击「确认需求」 | confirmed | **用户** |
| ai_ready | 用户手动编辑文档 | ai_ready（不变） | — |
| confirmed | 用户手动编辑文档 | reconfirm | 系统 |
| confirmed | 用户发送消息 | polishing | 系统 |
| reconfirm | 用户点击「确认需求」 | confirmed | **用户** |
| reconfirm | 用户发送消息 | polishing | 系统 |
| 任意 | AI 任何输出 | **绝不直接到 confirmed** | 硬约束 |

**不变量（用单元测试锁死）**：

1. `confirmed` 只能由 `user_confirm` 事件到达。
2. AI 流式回复结束时的状态写入只允许 `polishing → ai_ready` 或保持 `polishing`。
3. 标题、优先级、执行状态的修改不影响需求状态。
4. 每次需求状态变化必写一条 `requirement_status_changed` 活动。

**已知代价（D7）**：已确认后发送任何消息（哪怕无实质内容）都会回到 `打磨中` 并需重新确认。这是「AI 永不自动确认」硬规则的必然代价；「文档未变则保持已确认」的替代方案会增加状态机分支，MVP 不采用。

### 6.2 执行状态机

五种状态间**任意人工切换**（详情页下拉 / 执行视图拖拽），无自动流转，与需求状态完全解耦。每次变化写活动记录。

> P1 可选：对「需求未确认但执行状态改为进行中」给出软提醒（不阻断）。

### 6.3 确认入口收敛

「确认需求」按钮只出现在两处：详情页顶部、详情页对话区状态横幅。看板、列表、快捷键均不提供确认入口，确保用户确认前看过文档。

---

## 七、AI 需求打磨数据流

### 7.1 端到端时序

```
用户输入 → POST /api/todos/:id/chat {content}
  │
  ├─ 1. 落库 user message
  ├─ 2. 状态机：按 6.1 流转（pending/ai_ready/confirmed/reconfirm → polishing）
  ├─ 3. 组装 Prompt（system + 全部历史 + 本条）
  ├─ 4. fetch 上游 /chat/completions（stream=true）
  │
  ├─ 5. SSE 逐 delta 转发给浏览器 ──► 聊天气泡实时渲染
  │
  └─ 6. 流结束：解析完整文本（分隔符协议；失败/截断 → 一次 JSON mode 补救，见 7.2）
        ├─ 对话正文 → 落库 assistant message
        ├─ 文档块   → 更新 todos.requirementDoc + doc_updated 活动
        ├─ 充分标记 → YES: polishing→ai_ready；NO: 保持
        └─ SSE done 事件 → 前端失效缓存，刷新文档/状态/活动
```

### 7.2 输出协议（分隔符式，D4）

要求模型单轮输出三段：

```
（面向用户的对话回复：确认理解 / 提出 1~3 个关键问题 / 说明已纳入哪些点）
===REQUIREMENT_DOC===
（完整需求文档 Markdown，固定七节，见第九节；每轮全量重写）
===SUFFICIENT: YES===
```

- 充分性标记二选一：`===SUFFICIENT: YES===` / `===SUFFICIENT: NO===`。
- **解析容错与补救**：缺少任一分隔符，或上游 `finish_reason = length`（文档被 max_tokens 截断会丢充分性标记）→ 服务端自动补一次**非流式文档整理调用**（JSON mode，输入 = 本轮回复 + 历史，输出 `{document, sufficient}`），成功则正常落文档/状态，`done` 携带 `docRecovered: true`；补救仍失败 → 整段视为对话正文，**不更新文档、不改状态**，`done` 携带 `parseWarning: true`，前端提示「本轮需求文档未更新，可重试」。补救调用每轮至多一次。
- 流式期间前端只渲染第一个分隔符之前的文本；检测到分隔符后气泡尾部显示「正在整理需求文档…」。

### 7.3 System Prompt 模板（server/ai/prompt.ts）

```text
你是一名资深需求分析师，帮助独立开发者把模糊想法打磨成可直接交给
Coding Agent 执行的需求文档。你只负责需求分析，不写代码、不做产品决策。

## 项目上下文
项目名称：{{project.name}}
项目描述：{{project.description}}
技术栈：{{project.techStack}}
公共约束：{{project.constraints}}

## 当前任务
标题：{{todo.title}}
用户原始描述：{{todo.originalDescription}}

## 当前需求文档（可能为空；用户可能手动编辑过，以它为准继续完善）
{{todo.requirementDoc}}

## 工作方式
1. 识别需求中不明确、缺失的信息：业务场景、边界条件、技术约束、验收标准。
2. 每轮最多提出 3 个最关键的阻塞性问题，优先问影响方案方向的问题。
3. 不要重复问历史对话中已回答的问题。
4. 用户回答后，把结论纳入文档，并简述你更新了什么。
5. 用户手动编辑过的文档内容视为已确认的约束，除非用户明确要求修改，
   不得改写或删除。
6. 对照充分性清单逐项检查：目标明确 / 范围清晰 / 技术约束已知 /
   验收可验证 / 边界与排除明确 / 无阻塞性未决问题。
7. 全部满足时：不再提问，输出完整文档并标记 YES；否则标记 NO，
   把未确定项写入文档「尚未解决的问题」一节。
8. 你无权确认需求。即使信息充分，也只能提示用户去确认。

## 输出格式（严格遵守，分隔符独占一行）
先输出对话回复正文，然后：
===REQUIREMENT_DOC===
完整需求文档（Markdown，七节：需求背景/需求目标/功能范围/技术约束/
验收标准/排除范围/尚未解决的问题；无内容的节写「暂无」，验收标准用
- [ ] 清单；每轮都输出全量文档）
===SUFFICIENT: YES=== 或 ===SUFFICIENT: NO===

全程使用中文。
```

### 7.4 上下文与成本策略

- MVP：每次携带**全部历史消息**（单 Todo 对话通常 < 30 轮，可控）。
- 保护阈值：组装后超过模型上下文 70% 时，从最早的消息开始成对截断（保留 system 与最近 6 轮），并在对话区提示「早期对话已折叠」。P1 再做摘要压缩。
- `temperature` 固定 0.3（分析任务求稳）；`max_tokens` 默认 4096，可在设置页扩展（P1）。
- 文档每轮全量重写的输出 token 成本 MVP 接受；P1 引入 `===DOC_UNCHANGED===` 标记，文档无变化的轮次跳过重写。

### 7.5 SSE 协议（POST + fetch ReadableStream）

> EventSource 仅支持 GET，故前端用 `fetch` + `ReadableStream` 解析 SSE。

| 事件 | data | 说明 |
| --- | --- | --- |
| `delta` | `{text}` | 增量文本（含分隔符后的原始内容，前端自行截断显示） |
| `done` | `{assistantMessageId, sufficient, requirementStatus, docUpdated, docRecovered?, parseWarning?}` | 流正常结束 |
| `error` | `{message}` | 上游/解析错误；已落库的 user message 保留 |

- 中断：前端 AbortController → 服务端监听连接关闭 → AbortController 中止上游请求；半截 AI 回复不落库。
- 并发锁：同一 Todo 同时只允许一条活跃流（内存 Map），重复请求返回 409。
- 超时：上游 120s 无数据视为失败，发 `error`。

### 7.6 前端缓存联动（TanStack Query）

| Query Key | 失效时机 |
| --- | --- |
| `['todo', id]` / `['messages', id]` / `['activities', id]` | SSE `done` / `error`、确认、编辑文档、改执行状态 |
| `['todos', projectId]` / `['projects']` | 任何 Todo 状态/数量变化（看板徽标、项目统计同步） |
| `['settings']` | 保存设置 |

---

## 八、API 设计

统一前缀 `/api`；入参用 shared/schemas 的 zod 校验；错误格式 `{error: {code, message}}`；时间一律 unix ms。

### 8.1 项目

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/projects` | 列表 + 统计（总数/待打磨/已确认/updatedAt） |
| POST | `/projects` | 创建 |
| GET | `/projects/:id` | 详情 + 统计 |
| PATCH | `/projects/:id` | 编辑名称/icon/描述/技术栈/约束 |
| DELETE | `/projects/:id` | 级联删除全部 Todo（前端二次确认） |

### 8.2 Todo

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/projects/:id/todos` | 看板数据（含两状态、优先级、编号） |
| POST | `/projects/:id/todos` | 创建（标题/原始描述/优先级），初始 pending + todo |
| GET | `/todos/:id` | 详情（含 requirementDoc） |
| PATCH | `/todos/:id` | 改 title / priority / executionStatus / requirementDoc；服务端按状态机处理副作用 |
| DELETE | `/todos/:id` | 删除 |
| POST | `/todos/:id/confirm` | 确认需求；仅 ai_ready/reconfirm 允许，否则 409 |
| GET | `/todos/:id/messages` | 对话历史（升序） |
| POST | `/todos/:id/chat` | **SSE**，body `{content}`，见 7.5 |
| GET | `/todos/:id/activities` | 活动记录（降序） |
| GET | `/tasks` | 跨项目列表（全部任务页） |

### 8.3 导出与设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/todos/:id/export` | 返回 `text/markdown`，Todo 级模板（第九节） |
| GET | `/projects/:id/export` | 返回 `text/markdown`，项目级模板；无已确认任务返回 409 |
| GET | `/settings` | 读取 AI 配置 |
| PUT | `/settings` | 保存 AI 配置 |
| POST | `/settings/test` | 用请求体中的配置发最小测试请求，返回 `{ok, latencyMs, error?}` |

Copy 按钮流程：`GET export` → `navigator.clipboard.writeText` → toast「已复制，可直接粘贴给 Coding Agent」。

---

## 九、Markdown 导出模板

模板实现为 shared/markdown.ts 纯函数（输入结构化数据 → 输出字符串），便于快照测试。文档七节结构与 AI 输出协议一致。

### 9.1 Todo 级模板

````markdown
# TASK-001 优化消息加载速度

> 项目：小美客服 · 优先级：高 · 需求状态：已确认 · 导出时间：2026-11-13 15:00
> ⚠ 本需求尚未确认，内容可能继续变化（仅未确认时出现此行）

## 项目上下文
- 技术栈：Vue 2 + Element UI（管理端）/ uni-app（移动端）
- 公共约束：仅修改受影响模块，不做全局配置改动；i18n 只改源文件后重新构建

## 需求背景
（requirementDoc 第一节原文）

## 需求目标
…

## 功能范围
…

## 技术约束
…

## 验收标准
- [ ] 首屏可交互时间 < 500ms（本地 1000 条消息）
- [ ] …

## 排除范围
…

## 尚未解决的问题
（无则整节省略）
````

规则：
- 「项目上下文」由项目 techStack/constraints 生成（D5），为空则省略该节。
- 未确认 Todo 顶部加 ⚠ 行；已确认不加。
- `尚未解决的问题` 为空/「暂无」时省略整节。

### 9.2 项目级模板

````markdown
# 小美客服 · 已确认任务集

> 导出时间：2026-11-13 15:00 · 已确认任务：5 个
> 用法：将本文件交给 Coding Agent，按任务编号逐个执行；每个任务独立可验收。

## 项目背景
（project.description）

## 技术栈
（project.techStack）

## 公共约束
（project.constraints）

---

## TASK-001 优化消息加载速度
（该 Todo 的完整七节，同 9.1，不含项目上下文与元信息行）

---

## TASK-003 会话转接
…
````

规则：
- 仅导出 `confirmed` 状态任务，按编号升序。
- 无已确认任务：接口 409，前端按钮禁用 + tooltip「暂无已确认任务」。
- 项目背景/技术栈/约束为空的节省略。

---

## 十、MVP 任务拆分与验收

四个里程碑，严格按依赖顺序推进。规模：S ≤ 半天，M ≤ 1 天，L ≤ 2 天。

### M0 工程地基（可运行的空壳）

| ID | 任务 | 规模 | 验收标准 |
| --- | --- | --- | --- |
| M0-1 | pnpm workspace + web/server/shared 三包脚手架 | M | `pnpm dev` 同时起 Vite 与 Hono，浏览器可见壳页面 |
| M0-2 | Tailwind v4 + shadcn/ui 初始化、AppShell 侧边栏 | M | 侧边栏导航可点击，路由表全部可访问（空页面） |
| M0-3 | Drizzle + SQLite 接入、全部表 migration、WAL | M | 启动自动建库建表；删除 db 文件可重建 |
| M0-4 | shared 类型/枚举/zod + 统一 API 错误格式 | S | 前后端引用同一份类型，无 any 漂移 |
| M0-5 | `pnpm build && pnpm start` 单进程托管 | S | 8787 端口可完整使用应用 |

### M1 项目与 Todo 管理（无 AI 的完整看板）

| ID | 任务 | 规模 | 验收标准 |
| --- | --- | --- | --- |
| M1-1 | 项目 CRUD API + 列表页 + 新建/编辑弹窗 | M | 建删改项目，卡片统计正确，删除有二次确认 |
| M1-2 | Todo CRUD API + 编号生成 + 新建弹窗 | M | 创建后跳转详情；编号单调递增，删除后不复用 |
| M1-3 | 看板页双视图 + 卡片组件 + 默认隐藏已完成 | L | 五列渲染正确，两视图切换，「显示已完成」开关生效，徽标/数量准确 |
| M1-4 | 执行视图拖拽（dnd-kit）+ 乐观更新 | M | 拖拽改执行状态，失败回滚，活动记录落库 |
| M1-5 | 详情页骨架：顶部操作区 + 三区域布局 | M | 标题行内编辑、执行状态/优先级下拉可用 |
| M1-6 | 全部任务页（跨项目列表） | S | 数据正确，点击跳详情 |
| M1-7 | 设置页 + 测试连接 | M | 配置保存/读取；测试连接反馈真实结果 |
| M1-8 | 活动记录落库 + 详情页时间线 Tab | M | 创建/状态变更/文档更新均有时间线展示 |

### M2 AI 打磨闭环（产品核心）

| ID | 任务 | 规模 | 验收标准 |
| --- | --- | --- | --- |
| M2-1 | 状态机纯函数 + 单元测试 | M | 6.1 全部转换 + 4 条不变量测试通过 |
| M2-2 | Prompt 组装 + OpenAI 兼容流式客户端 | M | 携带项目上下文/原始描述/当前文档/全量历史；支持非流式 JSON mode（补救用） |
| M2-3 | 分隔符解析器 + 截断检测 + JSON mode 补救 + 单元测试 | M | 正常/缺分隔符/截断/补救成功/补救失败用例通过 |
| M2-4 | chat SSE 接口 + 并发锁 + 中断处理 | L | 流式落库、状态流转、409、停止不存半截回复 |
| M2-5 | 对话区 UI：气泡/流式渲染/停止/状态横幅 | L | 逐字渲染；分隔符后文本不进气泡；横幅随状态变化 |
| M2-6 | 需求文档 Tab：渲染 + 手动编辑 + 一级回退 + 状态副作用 | M | AI 每轮刷新；已确认后编辑 → 需重新确认；回退上一版可用 |
| M2-7 | 确认需求：按钮门控 + 二次确认弹窗 + confirmed_at | M | 仅两态可确认；看板/列表无确认入口 |
| M2-8 | AI 未配置/调用失败/解析失败的用户提示 | S | 三类异常均有明确引导，不白屏 |

### M3 交付与收尾

| ID | 任务 | 规模 | 验收标准 |
| --- | --- | --- | --- |
| M3-1 | shared/markdown 模板 + 快照测试 | M | 两模板输出与第九节一致；空节省略规则正确 |
| M3-2 | Todo/项目 Copy 全链路（卡片/详情/项目头） | M |  clipboard 内容正确；未确认 ⚠ 行；0 确认禁用 |
| M3-3 | 空态/加载态/错误态统一梳理 | M | 每个页面空态有引导；网络错误有 toast |
| M3-4 | 移动端可用性（抽屉导航 + 详情 Tab 化） | S | 375px 宽度下核心流程可走通 |
| M3-5 | 端到端手动验收 + README（启动/配置/备份） | M | 下方验收清单全过 |

### MVP 端到端验收清单（golden path）

1. 新建项目（填技术栈/约束）→ 新建 Todo → 自动进入详情页，状态 `待打磨`。
2. 发送第一条消息 → 状态变 `打磨中`，AI 流式回复并提出问题，右侧文档出现初版。
3. 回答 2~3 轮 → AI 标记充分 → 状态 `AI 已完成分析`，横幅提示确认。
4. 查看文档 → 点击确认 → 状态 `已确认`，活动记录出现确认事件。
5. 手动编辑文档 → 状态 `需重新确认` → 再次确认 → `已确认`。
6. 已确认后继续发消息 → 回到 `打磨中`，AI 不重复已答问题。
7. Todo Copy / 项目 Copy → 粘贴结果符合第九节模板。
8. 执行视图拖拽卡片 → 执行状态变化，需求状态不受影响。
9. 全程无任何路径能让 AI 自动把状态变成 `已确认`。

---

## 十一、测试策略

| 层 | 工具 | 重点 |
| --- | --- | --- |
| 纯函数单测 | Vitest | 状态机全转换表 + 不变量；分隔符解析容错；Markdown 模板快照；编号单调不复用 |
| API 集成 | Vitest + Hono `app.request` + 内存 SQLite | CRUD、confirm 门控（409）、PATCH 副作用、级联删除 |
| AI 链路 | 本地 mock OpenAI 服务（固定流式响应） | SSE 事件序列、中断、解析失败→补救成功/失败、finish_reason=length 截断、并发锁 |
| UI | 手动验收清单（第十节） | MVP 不引入 E2E 框架，控制成本 |

---

## 十二、风险与开放问题

### 风险

| 风险 | 应对 |
| --- | --- |
| 模型不遵循分隔符协议 | 解析失败/截断自动 JSON mode 补救调用（每轮至多一次）；仍失败才 parseWarning 提示重试；prompt 格式约束放最后强化 |
| 长对话超上下文 | 70% 阈值成对截断 + 前端提示；P1 做历史摘要 |
| better-sqlite3 原生模块安装失败 | 优先 prebuilt 二进制；README 注明 Node ≥ 22 |
| It's a Plan 为 AGPL-3.0 | 只借鉴交互与视觉方向，不复制其源码/资源；本仓库代码独立实现 |
| API Key 明文存本地 SQLite | 单机个人工具可接受；日志不打印；设置页明示隐私边界 |

### 开放问题（评审时定）

1. 需求文档手动编辑是否需要「与 AI 版本 diff」提示？（MVP 倾向不做）
2. 项目 icon 用 emoji 是否够用，还是引入图标库？（MVP 倾向 emoji）
3. 「全部任务」是否需要按项目分组展示？（MVP 倾向平铺 + 项目列）
4. 是否在 M3 后追加 P1：对话历史版本、需求修改历史、标签筛选？

---

## 附：与 PRD 的覆盖对照

| PRD 第九节要求 | 本文档章节 |
| --- | --- |
| 1. 页面路由和整体信息架构 | 三 |
| 2. 项目列表页、看板页、详情页布局 | 四 |
| 3. AI 多轮对话数据流和状态流转 | 六、七 |
| 4. Todo 与 Project 数据模型 | 五 |
| 5. Markdown 导出标准模板 | 九 |
| 6. MVP 开发任务拆分 | 十 |