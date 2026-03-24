# DataPay 产品架构设计 (Architecture)

## 系统全景图 (High-level Architecture)

DataPay 系统的核心理念是**“非侵入式的代理计费”**。数据提供方不需要修改原有的业务逻辑，只需将 DataPay 引擎部署在真实服务的前端即可。

```mermaid
graph TD
    A[AI Agent / LLM Client] -->|发起请求 HTTP GET /api/data| B(DataPay: wrap402 引擎)
    
    subgraph DataPay Node
        B --> |拦截请求, 检查 Auth/Payment| C{需要支付?}
        C -->|是, 缺少支付凭证| D[返回 HTTP 402 Payment Required]
        C -->|否, 凭证有效| E[放行请求执行]
    end
    
    D -.->|Agent 获取账单并支付| A
    
    E -->|情况 1: 本地静态资源| F[直接返回本地 JSON/CSV]
    E -->|情况 2: 动态反向代理| G[发送请求至上游 Real API]
    
    G --> H[返回真正数据并结算分账] --> B
    B --> A
    
    I[Web Dashboard] -->|Axios REST| B
    I -.->|WebSocket/SSE 日志 (Future)| B
```

## 核心组件拆解

### 1. 核心 HTTP 代理引擎 (`wrap402` Backend)
该服务（默认端口 `4020`）基于 Node.js Express 框架构建，职责包括：
- **配置文件持久化**：读取 `.wrap402.json` 作为资产状态（价格、路径、描述、类型）。
- **拦截器中间件 (Payment Middleware)**：拦截经过路由的流量，验证 Header 中的 `x-payment-token` 或签名认证。若未通过，抛出 402。
- **自动发现挂载点 (Auto-Discovery)**：自动映射 `/.well-known/x402-assets.json` 以供 AI 在爬取网站根目录时发现所有可售卖的接口。
- **反向代理模块**：对于通过了 402 检测的请求，若配置的是动态 URL 目标，将其无缝重定向和穿透。

### 2. 管理面板视图层 (Web Dashboard)
该服务（默认端口 `5173`）基于 React + Vite + Tailwind CSS 构建，职责包括：
- **实时监控 (Monitoring)**：可视化地呈现当前的计费拦截次数、通过次数、预计总收益。
- **资产大盘 (Assets Matrix)**：以卡片形式罗列目前引擎内代理了哪些数据/API，以及它们各自的定价。
- **一键上架 (Quick Publish)**：直接在网页终端填写真实 URL 和期望单次展示定价，提交后即刻生效至 `wrap402` 引擎，无需重启服务。

### 3. Agent 客户端基准演示 (Agent Demo)
- 提供基于 `agent-client.ts` 的自动拦截和购买处理逻辑，验证 402 HTTP 握手的闭环可用性。

## 技术栈选型
- **构建工具**: Vite + TypeScript
- **后端服务**: Node.js, Express, `http-proxy-middleware`
- **前端界面**: React, TailwindCSS, Lucide-React 
- **脚手架工具**: Commander.js (CLI), tsx
