# 🚀 DataPay (Cloud-Native Edition)

> **将任何闲置数据和 API，瞬间转化为 AI Agent 能自动付费调用的全云端微服务。**

DataPay 是一个基于 HTTP `402 Payment Required` 协议的轻量级开发框架。本项目已全面适配 **Cloudflare 云生态**，支持 Serverless 架构，在零服务器成本的情况下，实现全球低延迟的数据变现。

---

## ✨ 核心特性

- **☁️ 全云端托管 (Cloud-Native)**：基于 **Cloudflare Workers** 和 **Hono** 开发，无需维护物理服务器，全球秒级响应。
- **🗄️ 分布式数据库**：使用 **Cloudflare D1** 关系型数据库，完美平衡 Serverless 环境下的高性能与数据一致性。
- **🤖 AI 原生发现 (Auto-Discovery)**：支持 `x402-assets.json` 规范，AI Agent 可自动识别资产并获取计费信息。
- **🧠 智能代理网关 (Smart Agent Gateway)**：内置自然语言路由网关（`/api/v1/agent/ask`），Agent 发送模糊需求即可自动匹配资产及自动扣费。
- **🎨 赛博朋克控制台**：基于 React 开发的高级深色模式 Dashboard，实时监控营收、资产状态及调用分析。

## 📦 架构说明

本项目采用全 Serverless 架构：
1. **Backend (Workers)**: 基于 Hono 框架，部署在 Cloudflare Workers。
   - **鉴权**: JWT + HS256 指令签名。
   - **计费**: 402 状态码拦截与 D1 事务处理。
2. **Dashboard (Pages)**: 基于 Vite + React，部署在 Cloudflare Pages。
   - **环境变量**: 通过 `VITE_API_BASE` 实现前后端解耦。
3. **Database (D1)**: Cloudflare 原生 SQLite 兼容数据库。

## 🛠️ 快速上手

### 1. 环境准备
确保已安装 Node.js 和 Wrangler CLI：
```bash
npm install
```

### 2. 部署后端 (Worker)
```bash
# 创建 D1 数据库
npx wrangler d1 create datapay-db

# 初始化表结构
npx wrangler d1 execute datapay-db --remote --file=schema.sql

# 部署
npx wrangler deploy
```

### 3. 部署前端 (Pages)
1. 在 Cloudflare Pages 中连接你的 GitHub 仓库。
2. 配置环境变量 `VITE_API_BASE` 为你的 Worker URL。
3. 自动触发构建即可上线。

## 🎬 商业场景：AI 自动计费
当 AI Agent 请求数据但余额不足时，DataPay 会自动拦截并返回 `402 Payment Required` 响应，附带支付指导信息。这种“即付即用”的模式是 AI 商业化的核心未来。

---
*Powered by Cloudflare Workers & D1. Designed for the AI-to-AI economy.*
