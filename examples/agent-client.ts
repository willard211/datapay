// ============================================================
// DataPay / wrap402 - AI Agent Client Demo
// Demonstrates the full x402 payment flow
// ============================================================

const BASE_URL = 'http://localhost:4020';

async function main() {
  console.log('');
  console.log('🤖 AI 风控 Agent 模拟客户端');
  console.log('══════════════════════════════════════════');
  console.log('');

  // Step 1: Discover available data assets
  console.log('📋 Step 1: 发现可用数据资产...');
  console.log('─────────────────────────────────────────');

  const discoveryRes = await fetch(`${BASE_URL}/.well-known/x402-assets.json`);
  const discovery = await discoveryRes.json();

  console.log(`   找到 ${discovery.totalAssets} 个数据资产:`);
  for (const asset of discovery.assets) {
    console.log(`   • ${asset.name} — ${asset.price} ${asset.currency}/次`);
    console.log(`     ${asset.description}`);
    console.log(`     端点: ${asset.endpoint}`);
  }
  console.log('');

  // Step 2: Try accessing without payment → get 402
  const targetAsset = discovery.assets[0];
  console.log(`💰 Step 2: 请求数据 "${targetAsset.name}"（未支付）...`);
  console.log('─────────────────────────────────────────');

  const unpaidRes = await fetch(`${BASE_URL}${targetAsset.endpoint}`);
  console.log(`   HTTP 状态码: ${unpaidRes.status}`);

  if (unpaidRes.status === 402) {
    const paymentInfo = await unpaidRes.json();
    console.log(`   ✅ 收到 402 Payment Required`);
    console.log(`   协议版本: ${paymentInfo.x402Version}`);
    console.log(`   说明: ${paymentInfo.description}`);
    console.log(`   支付方式:`);
    for (const method of paymentInfo.accepts) {
      console.log(`     • ${method.scheme} on ${method.network}: ${method.amount} ${method.token}`);
      console.log(`       收款: ${method.payTo}`);
    }
  }
  console.log('');

  // Step 3: Make payment and access data
  console.log('🔑 Step 3: 构造支付并请求数据...');
  console.log('─────────────────────────────────────────');

  // Construct payment header (POC mode: simulated signature)
  const payment = {
    scheme: 'x402',
    network: 'internal',
    token: 'CNY',
    amount: targetAsset.price.toString(),
    payer: 'agent-risk-001',
    signature: 'demo-sig-' + Date.now().toString(36),
    timestamp: Date.now(),
  };

  const paidRes = await fetch(`${BASE_URL}${targetAsset.endpoint}?riskLevel=高风险`, {
    headers: {
      'X-PAYMENT': JSON.stringify(payment),
    },
  });

  console.log(`   HTTP 状态码: ${paidRes.status}`);

  if (paidRes.status === 200) {
    const result = await paidRes.json();
    console.log(`   ✅ 支付验证通过，数据已获取！`);
    console.log(`   资产: ${result.asset.name}`);
    console.log(`   总记录: ${result.pagination.total} 条（筛选后）`);
    console.log('');
    console.log('   📊 查询结果（高风险企业）:');
    console.log('   ─────────────────────────────────────────');

    for (const item of result.data) {
      console.log(`   🏢 ${item.companyName}`);
      console.log(`      风险等级: ${item.riskLevel} | 评分: ${item.riskScore}`);
      console.log(`      逾期: ${item.overdueCount}次 | 诉讼: ${item.lawsuitCount}次 | 处罚: ${item.administrativePenaltyCount}次`);
      console.log(`      状态: ${item.businessStatus}`);
      console.log('');
    }
  }

  // Step 4: Make another query with different filter
  console.log('🔍 Step 4: 再次查询（筛选低风险企业）...');
  console.log('─────────────────────────────────────────');

  const payment2 = {
    ...payment,
    signature: 'demo-sig-' + Date.now().toString(36),
    timestamp: Date.now(),
  };

  const paidRes2 = await fetch(`${BASE_URL}${targetAsset.endpoint}?riskLevel=低风险`, {
    headers: {
      'X-PAYMENT': JSON.stringify(payment2),
    },
  });

  if (paidRes2.status === 200) {
    const result2 = await paidRes2.json();
    console.log(`   ✅ 找到 ${result2.pagination.total} 家低风险企业`);
    for (const item of result2.data) {
      console.log(`   ✅ ${item.companyName} — 评分: ${item.riskScore} — ${item.industry}`);
    }
  }

  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('🎉 完整的 x402 支付流程演示完成！');
  console.log('');
  console.log('   流程回顾:');
  console.log('   1. Agent 通过 /.well-known/x402-assets.json 发现数据');
  console.log('   2. 请求数据 → 收到 HTTP 402 + 支付指令');
  console.log('   3. 构造支付 → 附带 X-PAYMENT 头重新请求 → 获取数据');
  console.log('   4. 按需查询，每次付费，精确到单次调用');
  console.log('');
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
