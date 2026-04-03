import * as crypto from 'crypto';

const ENGINE_URL = 'http://localhost:4020';
const AGENT_WALLET_PRIVATE_KEY = 'agent-wallet-1234';

// Simulate an intelligent risk control agent reviewing a loan
async function reviewLoanRequest(applicant: { name: string; idNumber: string; requestAmount: number }) {
  console.log(`\n🤖 [风控 Agent] 收到贷款申请审批任务...`);
  console.log(`👤 申请人: ${applicant.name} | 身份证号: ${applicant.idNumber} | 申请金额: ${applicant.requestAmount} CNY`);
  console.log(`🔍 正在启动背景调查，通过 Nexus402 市场寻找可用信贷风控数据源...`);

  // Step 1: Discover available API endpoints
  const discoveryRes = await fetch(`${ENGINE_URL}/.well-known/x402-assets.json`);
  const discoveryData = await discoveryRes.json();
  const assets = discoveryData.assets as any[];

  // Agent uses natural language / heuristic to identify the right datasets
  const loanRecordsAsset = assets.find(a => a.name.includes('借贷'));
  const blacklistAsset = assets.find(a => a.name.includes('黑名单'));

  if (!loanRecordsAsset || !blacklistAsset) {
    console.error('❌ 未能在 Nexus402 市场上找到所需的风控数据，无法完成审批。');
    return;
  }

  console.log(`\n💡 [风控 Agent] 在市场上发现了关联的动态 API/数据包:`);
  console.log(`   - [1] ${loanRecordsAsset.name} (单价: ${loanRecordsAsset.price} ${loanRecordsAsset.currency}/次)`);
  console.log(`   - [2] ${blacklistAsset.name} (单价: ${blacklistAsset.price} ${blacklistAsset.currency}/次)`);

  let finalDecision = "批准";
  let refusalReason = "";

  // Helper method to buy data
  async function purchaseAndFetchData(assetId: string, queryParam: string) {
    const targetUrl = `${ENGINE_URL}/api/v1/data/${assetId}?idNumber=${queryParam}`;
    
    // First try accessing -> EXPECT 402 Payment Required
    const initRes = await fetch(targetUrl);
    if (initRes.status === 402) {
      const invoiceData = await initRes.json();
      const amountStr = invoiceData.accepts[0].amount;
      const timestamp = Date.now().toString();
      
      // Auto sign payment transaction using Agent's local private key
      const payloadToSign = `${assetId}:${amountStr}:${timestamp}`;
      const mockSignature = crypto.createHmac('sha256', AGENT_WALLET_PRIVATE_KEY).update(payloadToSign).digest('hex');

      // Re-fetch with X-PAYMENT
      console.log(`   💸 [支付模块] 成功完成 X-402 协议代付. 支付对价: ${amountStr} CNY. 请求拿回数据...`);
      const paymentHeader = JSON.stringify({
        assetId: assetId,
        amount: amountStr,
        currency: 'CNY',
        timestamp: timestamp,
        signature: mockSignature,
        payer: 'Agent-RiskControl-V1'
      });

      const finalRes = await fetch(targetUrl, {
        headers: { 'X-PAYMENT': paymentHeader }
      });
      return await finalRes.json();
    }
  }

  console.log(`\n📡 [执行动作] Agent 调用【借款记录查询接口】...`);
  const loanData = await purchaseAndFetchData(loanRecordsAsset.id, applicant.idNumber);
  
  if (loanData && loanData.data.length > 0) {
    const record = loanData.data[0];
    console.log(`   📊 [数据解析] 发现活跃贷款 ${record.activeLoans} 笔，累计欠款: ${record.totalOutstandingBalance} 元。30天内逾期数: ${record.overdueCount30Days}`);
    if (record.overdueCount30Days > 0) {
      finalDecision = "拒绝";
      refusalReason += "借贷记录中存在近期频繁逾期;";
    }
  } else {
    console.log(`   📊 [数据解析] 该身份证未查询到借贷记录。`);
  }

  console.log(`\n📡 [执行动作] Agent 调用【失信黑名单查询接口】...`);
  const blackData = await purchaseAndFetchData(blacklistAsset.id, applicant.idNumber);
  
  if (blackData && blackData.data.length > 0) {
    const record = blackData.data[0];
    if (record.isBlacklisted) {
      console.log(`   🚨 [数据解析] 严重警告！命中最高法院失信被执行人黑名单！案件号: ${record.courtCaseNumber}`);
      finalDecision = "拒绝";
      refusalReason += "命中失信老赖黑名单;";
    }
  } else {
    console.log(`   ✅ [数据解析] 该用户未命中法院失信黑名单。`);
  }

  // Final Output
  console.log(`\n================================`);
  console.log(`🏁 审批结论：【${finalDecision}】`);
  if (finalDecision === '拒绝') {
    console.log(`📓 拒绝理由：${refusalReason}`);
  } else {
    console.log(`📓 通过额度：${applicant.requestAmount} CNY`);
  }
  console.log(`================================\n`);
}

// Execute Scenario
(async () => {
  await reviewLoanRequest({
    name: '张三',
    idNumber: '110105199001011234',
    requestAmount: 50000
  });
})();
