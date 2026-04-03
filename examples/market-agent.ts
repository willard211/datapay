/**
 * Market Trends Agent Test
 * Full E2E Flow: Discover -> Select -> Pay -> Access
 * This Agent specifically searches for "Market Trends" to demonstrate discovery.
 */
import { Nexus402Client } from '../sdk/typescript/src/index.js';

const BASE_URL = 'http://localhost:4020';

async function main() {
  console.log('🤖 [Market Agent] 启动中...');
  
  const client = new Nexus402Client({
    baseUrl: BASE_URL,
    payerId: 'market-researcher-agent',
    autoPay: true
  });

  try {
    // 1. Discovery
    console.log('🔍 [Market Agent] 正在全网搜索市场趋势相关数据资产...');
    const discovery = await client.discover();
    
    // Find the specific asset by name
    const asset = discovery.assets.find(a => a.name.includes('趋势') || a.id === '3F3klWuOPl');

    if (!asset) {
      console.error('❌ 未找到相关的行业趋势资产。');
      return;
    }

    console.log(`💡 [Market Agent] 识别到目标资产: "${asset.name}"`);
    console.log(`   描述: ${asset.description}`);
    console.log(`   费用: ${asset.price} ${asset.currency}/次`);

    // 2. Transaction & Call
    console.log('\n📡 [Market Agent] 正在发起按需调用（SDK 自动处理 402 支付）...');
    const data: any = await client.request(asset.endpoint);

    console.log('✅ [Market Agent] 交易成功，核心数据已解锁：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    data.data.forEach((item: any) => {
      console.log(`📌 课题: ${item.topic}`);
      console.log(`   增长: ${item.growth} | 预测: ${item.forecast}`);
      console.log(`   关键厂商: ${item.keyPlayers.join(', ')}`);
      console.log('────────────────────────────────────────────');
    });

    console.log('🏁 [Market Agent] 任务完成。');

  } catch (error: any) {
    console.error('❌ [Market Agent] 运行时错误:', error.message);
  }
}

main();
