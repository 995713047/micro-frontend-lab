#!/usr/bin/env node
/**
 * 一键启动三个应用（等价于分别开三个终端）。
 *
 * 为什么不用 concurrently 之类的库：
 *   只为了并行跑 3 个命令就引入一个依赖不划算，
 *   Node 自带的 child_process 足够，还能顺手给输出加前缀，日志更可读。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  { name: 'sub-vue  ', color: '\x1b[32m', workspace: '@mfe/sub-vue', port: 8081 },
  { name: 'sub-react', color: '\x1b[36m', workspace: '@mfe/sub-react', port: 8082 },
  { name: 'main     ', color: '\x1b[35m', workspace: '@mfe/main', port: 5173 },
];

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const children = [];
let shuttingDown = false;

function prefixStream(stream, label, color) {
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    process.stdout.write(`${color}[${label}]${RESET} ${line}\n`);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  children.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM');
  });

  setTimeout(() => process.exit(code), 300);
}

console.log(`${DIM}启动微前端实验室（3 个进程）…${RESET}`);
console.log(`${DIM}子应用先起，主应用后起，避免打开页面时子应用还没就绪。${RESET}\n`);

// 主应用放最后，给两个子应用一点启动时间
const ordered = [...TARGETS].sort((a, b) => (a.workspace === '@mfe/main' ? 1 : -1));

ordered.forEach((target, index) => {
  const delay = index * 600;

  setTimeout(() => {
    if (shuttingDown) return;

    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'dev', '--workspace', target.workspace],
      { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    prefixStream(child.stdout, target.name, target.color);
    prefixStream(child.stderr, target.name, target.color);

    child.on('exit', (code) => {
      if (!shuttingDown) {
        process.stdout.write(
          `${target.color}[${target.name}]${RESET} 进程退出，code=${code}\n`,
        );
        shutdown(code ?? 0);
      }
    });

    children.push(child);
  }, delay);
});

console.log(`
${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
  主应用        ${'\x1b[35m'}http://localhost:5173${RESET}
  子应用 A      ${'\x1b[32m'}http://localhost:8081${RESET}   （可独立访问调试）
  子应用 B      ${'\x1b[36m'}http://localhost:8082${RESET}   （可独立访问调试）
${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
  Ctrl+C 退出全部进程
`);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
