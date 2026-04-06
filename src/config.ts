// ============================================================
// Nexus402 / wrap402 - Configuration Manager
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Wrap402Config } from './types.js';

const CONFIG_FILE = '.wrap402.json';

/** Default configuration */
const DEFAULT_CONFIG: Wrap402Config = {
  projectName: 'my-nexus402',
  port: 4020,
  walletAddress: '',
  currency: 'CNY',
  assets: [],
};

/** Get the config file path */
export function getConfigPath(dir?: string): string {
  return resolve(dir || process.cwd(), CONFIG_FILE);
}

/** Load configuration from disk */
export function loadConfig(dir?: string): Wrap402Config {
  const configPath = getConfigPath(dir);
  if (!existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}\n请先运行 wrap402 init 初始化项目`);
  }
  const raw = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw) as Wrap402Config;
  const envPort = Number.parseInt(process.env.PORT || '', 10);

  // 托管平台通常会注入 PORT，优先使用运行时端口而不是仓库里的静态配置。
  if (Number.isFinite(envPort) && envPort > 0) {
    config.port = envPort;
  }

  return config;
}

/** Save configuration to disk */
export function saveConfig(config: Wrap402Config, dir?: string): void {
  const configPath = getConfigPath(dir);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/** Check if config exists */
export function configExists(dir?: string): boolean {
  return existsSync(getConfigPath(dir));
}

/** Create initial configuration */
export function createConfig(options: Partial<Wrap402Config> = {}, dir?: string): Wrap402Config {
  const config: Wrap402Config = {
    ...DEFAULT_CONFIG,
    ...options,
  };
  saveConfig(config, dir);
  return config;
}
