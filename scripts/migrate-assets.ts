import { db } from '../src/lib/db.js';
import { loadConfig } from '../src/config.js';
import { resolve } from 'path';

async function migrate() {
  console.log('--- 开始资产迁移 (JSON -> SQLite) ---');
  try {
    const config = loadConfig();
    
    // 找到一个默认用户作为这些老资产的所有者，或者先创建一个
    let defaultUser = await db.user.findFirst({ where: { username: 'admin' } });
    if (!defaultUser) {
      defaultUser = await db.user.findFirst();
    }
    
    if (!defaultUser) {
      console.log('未找到任何用户，请先运行服务或注册第一个用户。');
      return;
    }

    console.log(`使用用户 [${defaultUser.username}] 作为迁移资产的发布者。`);

    for (const asset of config.assets) {
      const existing = await db.asset.findUnique({ where: { id: asset.id } });
      if (existing) {
        console.log(`跳过已存在的资产: ${asset.name} (${asset.id})`);
        continue;
      }

      await db.asset.create({
        data: {
          id: asset.id,
          name: asset.name,
          description: asset.description,
          source: asset.source,
          sourceType: asset.sourceType,
          price: asset.price,
          currency: asset.currency || 'CNY',
          tags: JSON.stringify(asset.tags || []),
          totalQueries: asset.totalQueries || 0,
          totalRevenue: asset.totalRevenue || 0,
          providerId: defaultUser.id,
          publishedAt: new Date(asset.publishedAt || Date.now())
        }
      });
      console.log(`已迁移资产: ${asset.name}`);
    }

    console.log('--- 迁移完成 ---');
  } catch (err: any) {
    console.error(`迁移失败: ${err.message}`);
  } finally {
    await db.$disconnect();
  }
}

migrate();
