---
description: 项目级智能体指令：技能索引与代码改动流程
alwaysApply: true
---

# AGENTS（项目智能体指令）

> 本文件对齐项目文档规范使用中文。`SKILLS_TABLE` 标记内的技能索引是 openskills 生成内容的中文摘要，重新生成技能表会恢复英文模板，届时需人工同步翻译。

<skills_system priority="1">

## 可用技能

<!-- SKILLS_TABLE_START -->
<usage>
用户提出任务时，先检查下方可用技能能否更高效地完成。技能提供专项能力与领域知识。

使用方法：
- 调用：`npx openskills read <技能名>`（在 shell 中执行）
  - 多个技能：`npx openskills read skill-one,skill-two`
- 技能内容加载后包含完成任务的详细指令
- 输出中提供基础目录，用于解析捆绑资源（references/、scripts/、assets/）

使用须知：
- 只使用 <available_skills> 中列出的技能
- 已加载到上下文的技能不要重复调用
- 每次技能调用都是无状态的
</usage>

<available_skills>

<skill>
<name>algorithmic-art</name>
<description>用 p5.js 创作算法艺术（种子随机、参数交互探索）。用户要求生成艺术、代码艺术、向量流场（flow fields）或粒子系统时使用；创作原创内容，不得抄袭他人作品。</description>
<location>global</location>
</skill>

<skill>
<name>brand-guidelines</name>
<description>将 Anthropic 官方品牌色与排版应用于各类产物。涉及品牌色、视觉规范、企业设计标准时使用。</description>
<location>global</location>
</skill>

<skill>
<name>canvas-design</name>
<description>用设计方法论创作精美的 PNG/PDF 视觉作品。用户要求海报、艺术图、设计稿等静态作品时使用；坚持原创，不得抄袭。</description>
<location>global</location>
</skill>

<skill>
<name>doc-coauthoring</name>
<description>结构化的文档协作工作流。用户要写提案、技术规格、决策文档等结构化文档时使用：高效传递上下文、迭代打磨内容、面向读者验证。</description>
<location>global</location>
</skill>

<skill>
<name>docx</name>
<description>Word 文档（.docx）的创建、读取与编辑：页码目录、查找替换、批注修订、格式化等。用户提到 Word 文档或要求报告/备忘录类交付物时使用；不适用于 PDF、电子表格（走 xlsx 技能）、Google Docs 或通用编码任务。</description>
<location>global</location>
</skill>

<skill>
<name>frontend-design</name>
<description>打造有辨识度、生产级的前端界面。用户要求构建网页、组件、海报、仪表盘或美化任何 Web UI 时使用；产出精致且避免模板化 AI 审美。</description>
<location>global</location>
</skill>

<skill>
<name>internal-comms</name>
<description>按公司惯用格式撰写内部通讯：状态报告、管理层周报、公告、FAQ、事故复盘等。</description>
<location>global</location>
</skill>

<skill>
<name>mcp-builder</name>
<description>构建高质量 MCP（Model Context Protocol）服务器的指南，让 LLM 通过工具与外部系统交互（Python/FastMCP 或 Node/TypeScript MCP SDK）。</description>
<location>global</location>
</skill>

<skill>
<name>pdf</name>
<description>PDF 全操作：读取、合并拆分、加水印、填表单、加解密、提取内容、OCR。用户提到 .pdf 或要求生成 PDF 时使用。</description>
<location>global</location>
</skill>

<skill>
<name>pptx</name>
<description>PowerPoint（.pptx）的创建、读取、编辑与格式转换。任何涉及 .pptx 的输入输出（幻灯片、路演稿、备注、母版）都应使用。</description>
<location>global</location>
</skill>

<skill>
<name>skill-creator</name>
<description>创建或更新技能（skill）的指南，用于扩展智能体的专项能力与工作流。</description>
<location>global</location>
</skill>

<skill>
<name>slack-gif-creator</name>
<description>制作适配 Slack 的动态 GIF：约束校验、工具与动画概念。用户要求为 Slack 制作 GIF 时使用。</description>
<location>global</location>
</skill>

<skill>
<name>template</name>
<description>技能占位模板（尚未配置描述）。</description>
<location>global</location>
</skill>

<skill>
<name>theme-factory</name>
<description>为幻灯片、文档、落地页等产物套用主题样式，内置 10 套配色/字体预设，也可即时生成新主题。</description>
<location>global</location>
</skill>

<skill>
<name>web-artifacts-builder</name>
<description>用 React、Tailwind、shadcn/ui 构建复杂的多组件 claude.ai HTML 产物；适用于需要状态管理与路由的复杂应用，不适用于单文件 HTML/JSX。</description>
<location>global</location>
</skill>

<skill>
<name>webapp-testing</name>
<description>用 Playwright 与本地 Web 应用交互并测试：验证功能、调试 UI、截屏、查看浏览器日志。</description>
<location>global</location>
</skill>

<skill>
<name>xlsx</name>
<description>Excel 表格（.xlsx/.xlsm/.csv/.tsv）为主输入输出的任务：读写、公式、图表、格式转换、清洗结构化。交付物必须是表格文件时使用。</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>

## 代码改动流程

所有代码改动以 CLAUDE.md「PR 化 CR 闭环」章节为准：本地 CR 先于 push → PR 化 → 行内评论 CR → 本地正确性发现清零合并（CI 为辅助源、失败不阻塞），超 3 轮不收敛停止上报。
