import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { db } from '../src/lib/db.js';

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Load accounts
  const accountsPath = resolve(process.cwd(), '.wrap402-accounts.json');
  let adminUserId = '';
  
  if (existsSync(accountsPath)) {
    const accounts = JSON.parse(readFileSync(accountsPath, 'utf-8'));
    for (const [address, acc] of Object.entries(accounts)) {
      const dbUser = await db.user.upsert({
        where: { username: address },
        update: {},
        create: {
          username: address,
          password: 'default-password-change-me',
          apiKey: (acc as any).apiKey,
          webhookUrl: (acc as any).webhook,
          balance: (acc as any).balance,
        }
      });
      if (address === 'demo-user' || !adminUserId) {
        adminUserId = dbUser.id;
      }
      console.log(`✅ Migrated user: ${address}`);
    }
  }

  if (!adminUserId) {
    const fallbackUser = await db.user.create({
      data: {
        username: 'admin',
        password: 'admin',
        balance: 100,
      }
    });
    adminUserId = fallbackUser.id;
    console.log(`✅ Created default admin user`);
  }

  // 2. Load assets
  const configPath = resolve(process.cwd(), '.wrap402.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    for (const asset of config.assets) {
      // 避免重复导入
      const existing = await db.asset.findUnique({ where: { id: asset.id } });
      if (!existing) {
        await db.asset.create({
          data: {
            id: asset.id,
            providerId: adminUserId, // 之前的资产无拥有者概念，默认挂 admin 下
            name: asset.name,
            description: asset.description,
            source: asset.source,
            sourceType: asset.sourceType,
            price: asset.price,
            currency: asset.currency,
            tags: JSON.stringify(asset.tags || []),
            totalQueries: asset.totalQueries,
            totalRevenue: asset.totalRevenue,
            publishedAt: asset.publishedAt ? new Date(asset.publishedAt) : new Date(),
          }
        });
        console.log(`✅ Migrated asset: ${asset.name}`);
      }
    }
  }

  // 3. Load queries (logs)
  const queriesPath = resolve(process.cwd(), '.wrap402-queries.jsonl');
  if (existsSync(queriesPath)) {
    const lines = readFileSync(queriesPath, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const q = JSON.parse(line);
      
      // 找到 payer 的 user
      let payerUser = await db.user.findUnique({ where: { username: q.payer } });
      if (!payerUser) {
         payerUser = await db.user.create({ data: { username: q.payer, password: 'x' }});
      }

      // Check asset exist
      const assetExist = await db.asset.findUnique({ where: { id: q.assetId }});
      
      if (assetExist) {
        await db.transaction.create({
          data: {
            assetId: q.assetId,
            payerId: payerUser.id,
            amount: q.amount,
            timestamp: new Date(q.timestamp),
          }
        });
      }
    }
    console.log(`✅ Migrated ${lines.length} query records`);
  }

  console.log('🎉 Seeding finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
