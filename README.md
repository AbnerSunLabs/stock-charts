# stock-charts

基于 Next.js 的在线图表工具集。首页以一行多列展示工具入口，当前支持资产旭日图：按分类填写持仓金额，生成占比可视化图表。

## 技术栈

- **Next.js 14**（App Router）
- **React 18**
- **Ant Design 5**（UI 与 Message 全局提示）
- **@ant-design/charts**（旭日图）

## 快速开始

### 安装与运行

```bash
git clone https://github.com/你的用户名/stock-charts.git
cd stock-charts
npm install
npm run dev
```

浏览器访问：

- 首页：http://localhost:3000
- 旭日图：http://localhost:3000/view/sunburst

### 环境变量（可选）

```bash
cp .env.example .env.local
```

可选在 `.env.local` 中配置 `NEXT_PUBLIC_APP_URL`，用于 og:image / 链接预览。无敏感数据，访问无需 token。

## 功能说明

### 首页

- 一行 4 列网格展示工具入口卡片。
- 当前提供「旭日图生成」入口，点击「开始使用」进入旭日图页面。

### 旭日图

- **填写持仓**：在页面配置区输入总投资额（元）及各叶子分类持仓金额，占比自动计算并展示。
- **生成图表**：点击后根据当前金额配置渲染旭日图。
- **下载 PNG**：将当前旭日图导出为 PNG 图片。
- 操作结果通过 Ant Design 的 Message 做成功 / 失败提示。
- 页面顶部有面包屑，可从「首页」返回首页。

## 页面预览

- [组合看板自适应 Demo](output/portfolio-board-responsive-demo.html)：按实际容器宽度调整卡片列数，支持搜索、排序及原布局对照；正式组合看板已采用此布局，Demo 使用演示数据。见 [实现与验证说明](docs/design/portfolio-board-responsive-demo.md)。

## 分类结构

旭日图分类树固定为三级结构（A股 / 海外成熟 / 海外新兴及其子分类），定义在 `src/utils/position-category-tree.ts`。用户只需填写各叶子节点的持仓金额，系统按「节点金额 / 总投资额」计算占比。

## 项目结构

| 路径 | 说明 |
|------|------|
| `src/app/` | Next.js App Router 路由、布局、全局样式与 OG 入口 |
| `src/components/app-shell/` | 应用级 Provider 与主题切换组件 |
| `src/components/home/` | 首页工具入口组件 |
| `src/components/navigation/` | 页面导航组件 |
| `src/components/grid/` | 网格交易策略页面组件 |
| `src/components/sunburst/` | 旭日图持仓配置表单与图表组件 |
| `src/components/shared/` | 跨页面共享 UI 组件 |
| `src/hooks/` | 前端业务 Hook |
| `src/lib/` | 纯业务逻辑与解析函数 |
| `src/utils/` | 旭日图分类树与持仓占比计算 |
| `src/types/` | TypeScript 类型声明 |
| `__tests__/` | Jest 单元测试 |
| `e2e/` | Playwright E2E 测试 |

## 测试

```bash
npm test              # Jest 单元测试 + 管线集成
npm run test:ci       # CI 模式（含覆盖率）
npm run test:e2e      # Playwright E2E（首次需 npx playwright install chromium）
npm run test:all      # 单元 + E2E
```

GitHub Actions 在 push / PR 时自动运行 `npm test`、`npm run test:e2e` 与 `npm run build`。

## 构建与部署

```bash
npm run build
npm run start
```

可部署到 Vercel 等平台，无需必填环境变量。在 Vercel 项目设置中可选的 `NEXT_PUBLIC_APP_URL` 用于链接预览。

## 许可证

MIT
