#!/usr/bin/env node
// ============================================================
// DataPay / wrap402 - CLI Entry Point
// ============================================================
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';
import { createConfig, configExists, loadConfig, saveConfig } from './config.js';
import { loadAssetData } from './asset-loader.js';
import { startServer } from './server.js';
import { getQueryLogs } from './payment.js';
import { db } from './lib/db.js';
import type { AssetConfig } from './types.js';

const program = new Command();

program
  .name('wrap402')
  .description('🚀 将任何数字资产封装为 AI Agent 可发现、可付费的 x402 端点')
  .version('0.1.0');

// ──────────────────────────────────────────────
// Command: init
// ──────────────────────────────────────────────
program
  .command('init')
  .description('初始化 wrap402 项目')
  .option('-n, --name <name>', '项目名称', 'my-datapay')
  .option('-p, --port <port>', '服务端口', '4020')
  .option('-w, --wallet <address>', '钱包地址', 'demo-wallet-001')
  .option('-c, --currency <currency>', '默认货币', 'CNY')
  .action((options) => {
    if (configExists()) {
      console.log(chalk.yellow('⚠️  项目已初始化。如需重新初始化，请先删除 .wrap402.json'));
      return;
    }

    const config = createConfig({
      projectName: options.name,
      port: parseInt(options.port),
      walletAddress: options.wallet,
      currency: options.currency,
      assets: [],
    });

    console.log('');
    console.log(chalk.green('✅ wrap402 项目已初始化！'));
    console.log('');
    console.log(chalk.dim('  配置文件: .wrap402.json'));
    console.log(chalk.dim(`  项目名称: ${config.projectName}`));
    console.log(chalk.dim(`  服务端口: ${config.port}`));
    console.log(chalk.dim(`  钱包地址: ${config.walletAddress}`));
    console.log(chalk.dim(`  默认货币: ${config.currency}`));
    console.log('');
    console.log('  下一步:');
    console.log(chalk.cyan(`    wrap402 publish ./your-data.json --price 0.10 --name my-data`));
    console.log(chalk.cyan(`    wrap402 serve`));
    console.log('');
  });

// ──────────────────────────────────────────────
// Command: publish
// ──────────────────────────────────────────────
program
  .command('publish <file>')
  .description('将数据文件封装为 x402 付费端点')
  .option('--name <name>', '资产名称')
  .option('--desc <description>', '资产描述（AI Agent 会看到这段描述）')
  .option('--price <price>', '每次查询价格', '0.10')
  .option('--currency <currency>', '货币单位')
  .option('--tags <tags>', '标签（逗号分隔）', '')
  .action(async (file, options) => {
    if (!configExists()) {
      console.log(chalk.red('❌ 请先运行 wrap402 init 初始化项目'));
      return;
    }

    const spinner = ora('正在分析资产源...').start();
    const isApi = file.startsWith('http://') || file.startsWith('https://');
    let dataLength = '未知 (API代理)';
    let schema: Record<string, string> = {};

    try {
      if (!isApi) {
        const filePath = resolve(file);
        if (!existsSync(filePath)) {
          spinner.fail(`文件不存在: ${filePath}`);
          return;
        }
        const parsed = loadAssetData(filePath);
        dataLength = `${parsed.data.length} 条记录`;
        schema = parsed.schema;
        spinner.succeed(`数据加载成功: ${dataLength}`);
      } else {
        spinner.succeed(`已识别 API 端点: ${file}`);
      }

      const config = loadConfig();
      const assetId = nanoid(10);
      const assetName = options.name || (isApi ? 'API-Asset' : basename(file, '.json').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-'));

      const asset: AssetConfig = {
        id: assetId,
        name: assetName,
        description: options.desc || (isApi ? `${assetName} - 动态 API 接口` : `${assetName} - 包含 ${dataLength}，字段: ${Object.keys(schema).join(', ')}`),
        source: file,
        sourceType: isApi ? 'api' : (file.endsWith('.csv') ? 'csv' : 'json'),
        price: parseFloat(options.price),
        currency: options.currency || config.currency,
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
        publishedAt: new Date().toISOString(),
        totalQueries: 0,
        totalRevenue: 0,
      };

      // Create DB record
      let defaultUser = await db.user.findFirst();
      if (!defaultUser) {
        throw new Error('未找到可用用户，请先启动服务并进行注册');
      }

      await db.asset.upsert({
        where: { id: assetId },
        update: {
          name: asset.name,
          description: asset.description,
          price: asset.price,
          tags: JSON.stringify(asset.tags)
        },
        create: {
          id: assetId,
          name: asset.name,
          description: asset.description,
          source: asset.source,
          sourceType: asset.sourceType,
          price: asset.price,
          currency: asset.currency,
          tags: JSON.stringify(asset.tags),
          providerId: defaultUser.id
        }
      });

      // Legacy support: also save to config (optional, keeping for CLI simplicity)
      saveConfig(config);

      console.log('');
      console.log(chalk.green(`✅ 资产已发布并同步至数据库！`));
      console.log('');
      console.log(`  ${chalk.bold('资产信息')}`);
      console.log(`  ├── ID:     ${chalk.cyan(asset.id)}`);
      console.log(`  ├── 名称:   ${asset.name}`);
      console.log(`  ├── 描述:   ${asset.description}`);
      console.log(`  ├── 价格:   ${chalk.yellow(`${asset.price} ${asset.currency}/次`)}`);
      console.log(`  ├── 数据量: ${dataLength}`);
      if (!isApi) {
        console.log(`  └── 字段:   ${Object.entries(schema).map(([k, v]) => `${k}(${v})`).join(', ')}`);
      } else {
        console.log(`  └── 目标:   ${asset.source}`);
      }
      console.log('');
      console.log(`  📡 端点地址 (启动服务后):  GET /api/v1/data/${asset.id}`);
      console.log('');
      console.log('  下一步:');
      console.log(chalk.cyan(`    wrap402 serve          # 启动服务`));
      console.log(chalk.cyan(`    wrap402 publish <file>  # 发布更多资产`));
      console.log('');

    } catch (err: any) {
      spinner.fail(`加载失败: ${err.message}`);
    }
  });

// ──────────────────────────────────────────────
// Command: serve
// ──────────────────────────────────────────────
program
  .command('serve')
  .description('启动 x402 付费数据服务')
  .option('-p, --port <port>', '覆盖配置的端口')
  .action(async (options) => {
    if (!configExists()) {
      console.log(chalk.red('❌ 请先运行 wrap402 init 初始化项目'));
      return;
    }

    const config = loadConfig();
    if (options.port) {
      config.port = parseInt(options.port);
      saveConfig(config);
    }

    await startServer();
  });

// ──────────────────────────────────────────────
// Command: status
// ──────────────────────────────────────────────
program
  .command('status')
  .description('查看资产状态和调用统计')
  .action(async () => {
    if (!configExists()) {
      console.log(chalk.red('❌ 请先运行 wrap402 init 初始化项目'));
      return;
    }

    const config = loadConfig();
    const assets = await db.asset.findMany();
    const logs = await getQueryLogs();

    console.log('');
    console.log(chalk.bold(`  📊 ${config.projectName} - 资产状态`));
    console.log('  ─────────────────────────────────────');
    console.log('');

    if (assets.length === 0) {
      console.log(chalk.dim('  暂无资产。运行 wrap402 publish <file> 发布资产'));
    } else {
      let totalQueries = 0;
      let totalRevenue = 0;

      for (const asset of assets) {
        const assetLogs = logs.filter(l => l.assetId === asset.id);
        const queries = assetLogs.length || asset.totalQueries;
        const revenue = assetLogs.reduce((sum: number, l: any) => sum + l.amount, 0) || asset.totalRevenue;
        totalQueries += queries;
        totalRevenue += revenue;

        console.log(`  💰 ${chalk.bold(asset.name)} ${chalk.dim(`(${asset.id})`)}`);
        console.log(`     价格: ${chalk.yellow(`${asset.price} ${asset.currency}/次`)}`);
        console.log(`     调用: ${chalk.cyan(queries.toString())} 次  |  收入: ${chalk.green(`${revenue.toFixed(2)} ${asset.currency}`)}`);
        console.log(`     端点: GET /api/v1/data/${asset.id}`);
        console.log('');
      }

      console.log('  ─────────────────────────────────────');
      console.log(`  📈 总计: ${chalk.cyan(totalQueries.toString())} 次调用  |  ${chalk.green(`${totalRevenue.toFixed(2)} ${config.currency}`)} 收入`);
    }
    console.log('');
  });

// ──────────────────────────────────────────────
// Command: list
// ──────────────────────────────────────────────
program
  .command('list')
  .description('列出所有已发布的资产')
  .action(async () => {
    if (!configExists()) {
      console.log(chalk.red('❌ 请先运行 wrap402 init 初始化项目'));
      return;
    }

    const assets = await db.asset.findMany();
    console.log('');
    console.log(chalk.bold(`  📦 已发布资产 (${assets.length} 个)`));
    console.log('');

    for (const asset of assets) {
      console.log(`  • ${chalk.bold(asset.name)}`);
      console.log(`    ${chalk.dim(asset.description || '')}`);
      console.log(`    价格: ${chalk.yellow(`${asset.price} ${asset.currency}/次`)}  |  ID: ${chalk.dim(asset.id)}`);
      console.log('');
    }
  });

program.parse();
