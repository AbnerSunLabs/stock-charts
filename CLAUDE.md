---
description: 
alwaysApply: true
---

# [Stock-Charts] - Claude Code配置

## 1. 项目概览
- **项目描述**：当前项目主要是一个投研工具的集成网站，给用户提供一些工具从宏观层面了解自己的投资现状
- **技术栈**：Next.js 14 (App Router)、React 18、TypeScript 5、Ant Design 5、@ant-design/charts（Sunburst 等图表）、Tailwind CSS（Design Tokens 亮/暗主题）、Google Fonts（Outfit、DM Sans）、Jest + Playwright 测试、Vercel 部署；无后端/数据库
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
- 修改代码之后自动使用 /code-review 命令进行代码 CR
- 表单 UI：必填标签前加 `*`；禁止「可选/必选」文案；说明用 `QuestionCircleOutlined` + 白底最高层 Tooltip。详见 `.cursor/rules/form-field-chrome.mdc`
- 破坏性操作（删除等）：必须 `modal.confirm` 二次确认后再执行，禁止单击立即调 API。详见 `.cursor/rules/destructive-confirm.mdc`
