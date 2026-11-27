---
description: 
alwaysApply: true
---

# [Stock-Charts] - Claude Code配置

## 1. 项目概览
- **项目描述**：当前项目主要是一个投研工具的集成网站，给用户提供一些工具从宏观层面了解自己的投资现状
- **技术栈**：Next.js 14 (App Router)、React 18、TypeScript 5、Ant Design 5、@ant-design/charts（Sunburst 等图表）、Tailwind CSS（Design Tokens 亮/暗主题）、Google Fonts（Outfit、DM Sans）、Jest + Playwright 测试、Vercel 部署；Supabase 负责共享行情只读查询与用户数据 CRUD，数据职责见 `.cursor/rules/dual-repo-data-boundary.mdc`
- **当前阶段**：开发阶段

## 2. 代码规范
### 通用规则
- 所有代码必须有类型注解
- 函数不超过50行，类不超过300行
- 禁止使用any类型（特殊情况需注释说明）

### 命名约定
- 文件名：kebab-case（如 user-service.ts）
- 类名：PascalCase（如 UserService）
- 函数/变量：camelCase（如 getUserById）
- 常量：UPPER_SNAKE_CASE（如 MAX_RETRY_COUNT）

### 文档要求
- 所有公共API必须有JSDoc/TSDoc注释
- 复杂业务逻辑必须有流程说明
- 使用中文注释，代码用英文

## 3. 安全规则
### 禁止行为
- 禁止在代码中硬编码敏感信息
- 禁止提交.env文件到仓库
- 禁止在日志中输出用户隐私数据

### 必须行为
- 所有输入必须验证和消毒
- API必须有速率限制

## 4. 测试要求
- 新功能必须覆盖单元测试，E2E测试
- 核心逻辑测试覆盖率>80%
- 集成测试必须覆盖主要用户流程

## 5. Git规范
### 分支命名
- feature/xxx：新功能
- fix/xxx：bug修复
- refactor/xxx：重构
- docs/xxx：文档更新

### 提交信息
格式：`<type>(<scope>): <description>`

类型：feat、fix、docs、style、refactor、test、chore

## 6. 项目特殊说明
- 所有代码改动走第 7 节「PR 化 CR 闭环」流程，禁止直推 main
- 表单 UI：必填标签前加 `*`；禁止「可选/必选」文案；说明用 `QuestionCircleOutlined` + 白底最高层 Tooltip。详见 `.cursor/rules/form-field-chrome.mdc`
- 破坏性操作（删除等）：必须 `modal.confirm` 二次确认后再执行，禁止单击立即调 API。详见 `.cursor/rules/destructive-confirm.mdc`

## 7. PR 化 CR 闭环（所有代码改动强制流程）

PR 即任务触发器：创建 PR 后必须完成 CR 闭环才能合并，任何环节不得跳过。
本节为用户 2026-11-27 明确授权的常设流程：本仓代码改动的 push 与建 PR 由本节授权，无需逐次确认；`dual-repo-branch-sync.mdc` 的「未经用户明确要求不 push、不建 PR」条款**对本仓改动由本节覆盖**，对 scheduled-tasks 仓仍生效（不主动 push）；其双仓同名分支、数据边界、回 main 同步约定两仓均适用。

1. **本地先行**：改动提交到 `<type>/<语义名>` 分支（type 按第 5 节：feature/fix/docs/refactor；双仓场景同步建同名分支）→ 本地 CR（`/code-review` 审未推送 diff，对齐全局「CR 先于 push」）→ 处置完毕才 push
2. **建 PR**：push 后 `gh pr create` 到 main（中文 Conventional Commits，PR 描述含改动说明与验证记录）
3. **PR CR**：`/code-review <PR号> --comment` 贴行内评论留档；与第 1 步同 diff 且无新提交时可将本地发现转贴、不重复全量审；**处置循环产生新 push 后必须复审**
4. **处置循环**：正确性缺陷必须修复（commit + push 后复审）；策略/防御性建议挂账不阻塞（记入 PR 评论或最终汇报）
5. **收敛线**：本地与 CI（`.github/workflows/claude-code-review.yml`，PR 打开/更新自动触发）**两源正确性发现均清零**方可合并——CI 在运行则等待完成并读取其发现（`gh run watch` / `gh pr view --comments`）；CI 未配置或不可用时记录后以本地主审为准。**循环超过 3 轮仍不收敛时停止并向用户汇报**，禁止无限返工
6. **合并**：`gh pr review --approve`——单人仓库（作者=审查者同账号）**预期被平台拒绝，属正常路径**，记录后跳过；随后 `gh pr merge <PR号> --squash --delete-branch`
7. **收尾**：本地 main 同步（双仓场景两边一起切回 main）；有运行时交付物的改动须端到端验证后才算完成；汇报结果与挂账清单

环境备注：本机访问 GitHub 可能需代理，push/gh 失败时先测直连，不通再探测本机代理端口（如 `127.0.0.1:7890`）用命令级代理重试（`git -c http.proxy=... push`），不写入全局配置。
