#!/usr/bin/env node
/** 清理所有构建产物与缓存 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'apps/main/dist',
  'apps/sub-vue/dist',
  'apps/sub-react/dist',
  'apps/sub-vue/node_modules/.cache',
  'apps/sub-react/node_modules/.cache',
  '.mfe-chrome',
];

let removed = 0;

targets.forEach((relative) => {
  const absolute = path.join(ROOT, relative);
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, { recursive: true, force: true });
    console.log(`[clean] 已删除 ${relative}`);
    removed += 1;
  }
});

console.log(removed ? `[clean] 完成，共删除 ${removed} 项` : '[clean] 没有需要清理的内容');
