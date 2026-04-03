/**
 * Nexus402 SDK Usage Example
 * Demonstrates how to use the Nexus402Client to transparently handle 402 payments.
 */
import { Nexus402Client } from '../sdk/typescript/src/index.js'; // Using src directly for tsx support

const BASE_URL = 'http://localhost:4020';

async function main() {
  console.log('🚀 [SDK Demo] Starting Nexus402 SDK demonstration...');

  // 1. Initialize client with autoPay: true
  const client = new Nexus402Client({
    baseUrl: BASE_URL,
    payerId: 'agent-sdk-007',
    autoPay: true
  });

  try {
    // 2. Discover assets
    console.log('\n🔍 [SDK Demo] Discovering assets...');
    const discovery = await client.discover();
    console.log(`✅ Found ${discovery.totalAssets} assets.`);
    
    const targetAsset = discovery.assets[0];
    console.log(`📡 Target Asset: ${targetAsset.name} (${targetAsset.price} ${targetAsset.currency})`);

    // 3. Request data (The SDK will handle the 402 flow automatically!)
    console.log('\n💰 [SDK Demo] Requesting data (Auto-paying if 402)...');
    const result: any = await client.request(targetAsset.endpoint, {
      params: { riskLevel: '高风险' }
    });

    console.log('✅ Data retrieved successfully!');
    console.log(`📦 Asset: ${result.asset.name}`);
    console.log(`📊 Records: ${result.data.length}`);
    
    console.log('\n📋 Sample Data:');
    result.data.slice(0, 2).forEach((item: any) => {
      console.log(`   🏢 ${item.companyName} | Risk: ${item.riskLevel} | Score: ${item.riskScore}`);
    });

    console.log('\n🎉 [SDK Demo] SDK abstraction works! No manual 402 handling needed.');

  } catch (error: any) {
    console.error('❌ [SDK Demo] Error:', error.message);
  }
}

main();
