# 🚀 DataPay / wrap402

> **将任何闲置数据和 API，瞬间转化为 AI Agent 能自动付费调用的微服务。**

DataPay (底层 CLI 引擎名 `wrap402`) 是一个基于 HTTP `402 Payment Required` 状态码和最新 Web3 付费网关协议的轻量级开发框架。它能让你在**零开发成本**的情况下，把本地的 Excel/JSON 数据、或者是你公司现有的免费 HTTP API，一键包装成“大模型友好”的高级收费接口。

无论是开发垂直领域信贷分析大模型，还是给自己的 AI 项目挂载收费数据源，DataPay 都是完美的闭环解决方案。

---

## ✨ 核心特性

- **🤖 AI 原生发现 (Auto-Discovery)**：内置 `/.well-known/x402-assets.json` 和 `openapi.json` 挂载点，任意支持联网规范的 AI Agent 都会自动解析资产货架并知道如何买单。
- **🔌 动态 API 逆向代理与计费拦截**：不仅支持静态文件（JSON/CSV）和网页抓取（Scraper），还能填入第三方 URL，引擎会在前端执行计费拦截，收到钱后再隐式调用上游真正 API 返回数据。
- **🧠 智能代理网关 (Smart Agent Gateway)**：内置自然语言路由网关（`/api/v1/agent/ask`）。Agent 只需发送通用需求（如“帮我查一下这家公司的信用”），网关会自动匹配相关资产、扣费并返回最终结构化数据——无需代码硬编码资产 ID！
- **💼 完整账户与回调系统**：内置开箱即用的开发者账户系统（API Key 管理、余额控制）和指数退避的 Webhook 异步回调机制。
- **🛠️ TypeScript SDK (`DataPayClient`)**：提供极简的 SDK，几行代码就能完成 `discover()` 资产发现、带有自动 402 处理重试机制的 `request()` 以及余额查询。
- **🎨 极客风 Web 控制台 (Dashboard)**：基于 React + Tailwind 开发的赛博朋克深色仪表盘。包括多端融合的控制中心、动态真实数据驱动的商业洞察分析页、API 资产市场（含一键测试文档）以及可视化的 Agent 实验室。

## 📦 架构说明

本项目分为两个完全解耦的独立引擎：
1. **Core Backend (`src/`)**：基于 Express 的 NodeJS 包裹引擎（端口默认为 `4021`）。
   - **数据持久化**：采用 Prisma + PostgreSQL，支持多租户资产管理。
   - **鉴权中心**：内置 JWT 身份验证与 API Key 轮转机制。
   - **402 计费**：负责计费熔断、鉴权、真实数据代理透传。
2. **Web Dashboard (`dashboard/`)**：可视化管理面板。
   - **模块化架构**：基于 React + TypeScript 的重构版本，组件深度解耦。
   - **混合支付**：集成全球 Stripe 结算与境内聚合支付模拟。
   - **商业洞察**：动态真实数据驱动的营收与流量分析图表。

## 🛠️ 快速上手

### 1. 安装核心依赖
确保已安装 Node.js (v18+) 和 PostgreSQL，然后配置数据库环境变量并运行迁移：
```bash
npm install
npx prisma migrate dev
npx tsx scripts/migrate-assets.ts  # 迁移旧 JSON 数据到数据库
npm run build
```

### 2. 启动数据包装引擎
启动主网络服务器，它将开启 `4021` 端口：
```bash
# 默认启动
npx tsx src/cli.ts serve
```

### 3. 启动管理控制台 Dashboard
进入 `dashboard` 目录运行：
```bash
cd dashboard
npm install
npm run dev
```

## 🎬 终极场景演示：金融风控 Agent

为了验证 x402 闭环，我们在 `examples` 下沙盒模拟了一个真实商业应用场景 —— **小额贷款信用审查机器人**。

在这个用例中，审批程序发现张三来借贷，但是自身没有中国人民银行的征信接口，于是立刻通过 DataPay 上游的发现端点寻找第三方风控数据源，并在遭遇 402 HTTP 拦截时自动签发数字凭据购买。

**使用方法：**

在确保 4020 端口服务端正开启的情况下，任意开一个终端运行：
```bash
npx tsx examples/financial-agent.ts
```

你将看到极具科幻感的终端日志流打印：AI 如何发掘了“借贷记录API”和“最高法老赖黑名单API”，并分别支付 0.5CNY 和 1CNY 买到了核心档案，最终生成拒绝贷款报告卡的全过程。

---
*Created as part of the POC phase to revolutionize AI-to-AI / Agent-to-Agent Micro-transactions. Phase 9: Infrastructure Hardening & Commercialization Ready.*
