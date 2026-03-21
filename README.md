# 🚀 DataPay / wrap402

> **将任何闲置数据和 API，瞬间转化为 AI Agent 能自动付费调用的微服务。**

DataPay (底层 CLI 引擎名 `wrap402`) 是一个基于 HTTP `402 Payment Required` 状态码和最新 Web3 付费网关协议的轻量级开发框架。它能让你在**零开发成本**的情况下，把本地的 Excel/JSON 数据、或者是你公司现有的免费 HTTP API，一键包装成“大模型友好”的高级收费接口。

无论是开发垂直领域信贷分析大模型，还是给自己的 AI 项目挂载收费数据源，DataPay 都是完美的闭环解决方案。

---

## ✨ 核心特性

- **🤖 AI 原生发现 (Auto-Discovery)**：内置 `/.well-known/x402-assets.json` 和 `openapi.json` 挂载点，任意支持联网规范的 AI Agent 都会自动解析你的资产货架并知道如何买单。
- **🔌 动态 API 逆向代理 (Reverse Proxy)**：不仅支持静态文件，还能填入真实的第三方 URL（例如汇率 API、失信黑名单库），引擎会在前端执行计费拦截，收到钱后再隐式调用上游真正 API 返回数据。
- **🎨 极客风 Web 控制台 (Dashboard)**：自带 Vite + React + TailwindCSS 开发的顶级赛博朋克深色仪表盘。可视化查看 AI 调用流水账单，**支持在网页端一键上架新 API，内存无缝热重载**。
- **🛡️ 密码学验证 (x402 Protocol)**：完整模拟 X-PAYMENT 签名交易体系。

## 📦 架构说明

本项目分为两个完全解耦的独立引擎：
1. **Core Backend (`src/`)**：基于 Express 的 NodeJS 包裹引擎（端口默认为 `4020`）。负责 402 计费熔断、鉴权、真实数据代理透传。
2. **Web Dashboard (`dashboard/`)**：可视化数据平台管理面板（端口默认为 `5173`）。使用 Axios 与后端互动。

## 🛠️ 快速上手

### 1. 安装核心依赖
确保已安装 Node.js (v18+)，然后进入根目录安装依赖：
```bash
npm install
npm run build
```

### 2. 启动数据包装引擎
启动主网络服务器，它将开启 `4020` 计费端口：
```bash
npx tsx src/cli.ts serve
```
*(你也可以通过 `npx tsx src/cli.ts publish <path/url> --name "数据" --price 1` 在命令行发布新资产)*

### 3. 启动管理控制台 Dashboard
新开一个终端终端，进入 `dashboard` 目录运行：
```bash
cd dashboard
npm install
npm run dev
```
打开 `http://localhost:5173/` 即可看到炫酷的 SaaS 管理页面。

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
*Created as part of the POC phase to revolutionize AI-to-AI / Agent-to-Agent Micro-transactions.*
