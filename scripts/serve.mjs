#!/usr/bin/env node
/**
 * 本地模拟生产部署：把三个应用的 dist 拼成一个站点。
 *
 * 和容器部署的区别只有"谁来做反向代理"：
 *   这里是 Node 的静态服务器，生产是 nginx —— 路由规则完全一致。
 *
 * 用法：
 *   npm run build && npm run serve
 *   MFE_ISOLATION=none npm run serve      # 换环境变量，不重新构建
 *   MFE_REGISTRY_URL= npm run serve       # 关掉远端注册表，验证降级路径
 */
import { assertBuildsExist, createStaticServer, DIST_DIRS } from './lib/server.mjs';

const port = Number(process.env.PORT) || 4173;

const missing = assertBuildsExist();
if (missing.length) {
  console.error(`\x1b[31m[serve] 缺少构建产物：${missing.join(', ')}\x1b[0m`);
  console.error('[serve] 先执行 npm run build');
  process.exit(1);
}

console.log('[serve] 产物目录：');
Object.entries(DIST_DIRS).forEach(([name, dir]) => console.log(`  ${name.padEnd(10)} ${dir}`));

const server = await createStaticServer({ port });
console.log(`[serve] 打开 ${server.url} 查看生产形态`);

const close = async () => {
  await server.close();
  process.exit(0);
};

process.on('SIGINT', close);
process.on('SIGTERM', close);
