# 贡献指南

安装 Node.js 22 和仓库指定版本的 pnpm 后运行 `pnpm install`，安装依赖并启用提交前检查。

使用仓库的 Prettier 规则统一格式，包括两个空格缩进、分号、单引号和 LF 换行。VS Code 安装推荐扩展后可在保存时自动格式化。

- `pnpm format:check` 检查格式。
- `pnpm format` 格式化仓库。
- `pnpm lint` 检查代码质量与 React Hooks。

提交前检查只处理暂存文件。提交标题使用 `类型(范围): 中文说明`，一个提交只做一件事。全仓格式化单独提交，可将其提交 SHA 写入 `.git-blame-ignore-revs`。

GitHub Actions 验证格式、Lint、类型、测试和构建。维护者可通过分支保护将 CI 设为合并前必需检查。
