#!/usr/bin/env node
/**
 * 端到端验证：真的拉一个无头 Chrome，把生产形态的三端跑起来。
 *
 * 验证两件事：
 *   A. 挂载 —— 每个路由下，该出现的子应用是否真的渲染出来了；
 *   B. 通信 —— 在通信实验室里点主应用的「count +1」，
 *      断言两个子应用读到的是同一个全局状态（这是真的端到端，不是看日志）。
 *
 * 为什么不用 `chrome --dump-dom`：
 *   strictStyleIsolation 会把子应用内容放进 ShadowRoot，
 *   而 documentElement.outerHTML **不会**序列化 Shadow 内容，
 *   结果就是"隔离得越好，越检测不到"。所以这里走 CDP，主动穿透 Shadow 边界。
 *
 * 另：必须带 --no-sandbox。在没有完整桌面会话的环境里（CI / 容器 / 受限沙箱），
 * Chrome 的渲染进程起不来，表现为 WebSocket 连上了但 Runtime.enable 永远不响应。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertBuildsExist, createStaticServer, ROOT } from './lib/server.mjs';

const CHROME_BINARIES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  process.env.CHROME_PATH,
].filter(Boolean);

const DEBUG_PORT = Number(process.env.CDP_PORT) || 9333;
const VERIFY_PORT = Number(process.env.VERIFY_PORT) || 4199;
const PROFILE_DIR = path.join(ROOT, '.mfe-chrome');
const WAIT_MS = Number(process.env.VERIFY_WAIT_MS) || 15000;

const MARKER = {
  'sub-vue': '样式污染演示卡片（子应用 A）',
  'sub-react': '样式污染演示卡片（子应用 B）',
};

const ROUTES = [
  { path: '/', apps: [], note: '总览页（无子应用）' },
  { path: '/sub-vue', apps: ['sub-vue'], note: '单挂子应用 A' },
  { path: '/sub-react', apps: ['sub-react'], note: '单挂子应用 B' },
  { path: '/lab/isolation', apps: ['sub-vue', 'sub-react'], note: '两个子应用同屏 · 隔离实验室' },
  {
    path: '/lab/communication',
    apps: ['sub-vue', 'sub-react'],
    note: '两个子应用同屏 · 通信实验室',
    comm: true,
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  return CHROME_BINARIES.find((bin) => bin && fs.existsSync(bin)) || null;
}

/** 注入到页面里的公共工具：穿透 Shadow 边界查找元素 */
const DEEP_FINDER = `
  const findDeep = (selector) => {
    const results = [];
    const walk = (node) => {
      const kids = node.children ? Array.from(node.children) : [];
      for (const el of kids) {
        if (el.matches && el.matches(selector)) results.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
        walk(el);
      }
    };
    walk(document.body || document.documentElement);
    return results;
  };
  const collectText = (root) => {
    let out = root.textContent || '';
    const walk = (node) => {
      const kids = node.children ? Array.from(node.children) : [];
      for (const el of kids) {
        if (el.shadowRoot) out += ' ' + collectText(el.shadowRoot);
        walk(el);
      }
    };
    walk(root);
    return out;
  };
`;

function buildMountProbe() {
  return `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  ${DEEP_FINDER}

  const markers = ${JSON.stringify(MARKER)};
  const needed = Object.values(markers);
  const deadline = Date.now() + ${WAIT_MS};
  let text = '';
  let shadows = [];

  while (Date.now() < deadline) {
    text = collectText(document.body || document.documentElement);
    shadows = findDeep('.mfe-host');
    if (needed.every((m) => text.includes(m))) break;
    await sleep(250);
  }

  const flat = text.replace(/\\s+/g, ' ');
  const cfg = window.__MFE_CONFIG__ || {};
  const sv = findDeep('.sv-root')[0];
  const sr = findDeep('.sr-root')[0];

  return {
    title: document.title,
    env: cfg.env || null,
    isolation: cfg.defaultIsolation || null,
    shadowRootCount: findDeep('*').filter((el) => el.shadowRoot).length,
    hostBars: findDeep('.mfe-host__bar').map((el) =>
      (el.textContent || '').replace(/\\s+/g, ' ').trim(),
    ),
    errorMasks: findDeep('.mfe-host__mask--error').map((el) =>
      (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160),
    ),
    subVueConnected: sv ? sv.getAttribute('data-mfe-connected') : null,
    subReactConnected: sr ? sr.getAttribute('data-mfe-connected') : null,
    found: Object.fromEntries(
      Object.entries(markers).map(([name, marker]) => [name, flat.includes(marker)]),
    ),
  };
})()`;
}

/** 真实的跨应用通信断言：点主应用按钮，看两个子应用拿到的 count 是否同步 */
function buildCommProbe() {
  return `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  ${DEEP_FINDER}

  const readCounts = () => {
    const shell = document.querySelector('.app-shell');
    const sv = findDeep('.sv-root')[0];
    const sr = findDeep('.sr-root')[0];
    return {
      main: Number(shell && shell.getAttribute('data-mfe-count')),
      subVue: Number(sv && sv.getAttribute('data-mfe-count')),
      subReact: Number(sr && sr.getAttribute('data-mfe-count')),
    };
  };

  const before = readCounts();
  const btn = Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes('主应用 count +1'),
  );

  if (!btn) return { error: '找不到「主应用 count +1」按钮', before, after: before };

  const ROUNDS = 3;
  for (let i = 0; i < ROUNDS; i += 1) {
    btn.click();
    await sleep(150);
  }

  const deadline = Date.now() + 8000;
  let after = readCounts();

  while (Date.now() < deadline) {
    after = readCounts();
    const allEqual = after.main === after.subVue && after.subVue === after.subReact;
    if (allEqual && after.main === before.main + ROUNDS) break;
    await sleep(200);
  }

  return { before, after, rounds: ROUNDS };
})()`;
}

/** 极简 CDP 客户端，基于 Node 22 内置的 WebSocket，零额外依赖 */
class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
        return;
      }

      if (msg.method) this.events.push(msg);
    });
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), 10000);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(new CdpSession(ws));
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(`WebSocket 连接失败：${wsUrl}`));
      });
    });
  }

  send(method, params = {}, timeout = 30000) {
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 超时：${method}`));
        }
      }, timeout);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }

  /** 提取 console error / warning 与运行时异常 */
  collectProblems() {
    const problems = [];

    for (const event of this.events) {
      if (event.method === 'Runtime.consoleAPICalled') {
        const type = event.params.type;
        if (type !== 'error' && type !== 'warning') continue;
        const text = (event.params.args || [])
          .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) problems.push({ level: type, text: text.slice(0, 240) });
      }

      if (event.method === 'Runtime.exceptionThrown') {
        const detail = event.params.exceptionDetails;
        problems.push({
          level: 'exception',
          text: (detail.exception?.description || detail.text || '')
            .replace(/\s+/g, ' ')
            .slice(0, 240),
        });
      }

      if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
        problems.push({
          level: 'error',
          text: (event.params.entry.text || '').replace(/\s+/g, ' ').slice(0, 240),
        });
      }
    }

    const seen = new Set();
    return problems.filter((p) => {
      const key = `${p.level}:${p.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

async function waitForDevTools(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return res.json();
    } catch (e) {
      lastError = e.message;
    }
    await sleep(300);
  }

  throw new Error(`DevTools 未就绪：${lastError}`);
}

async function openSession(port, url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(`无法新建标签页：HTTP ${res.status}`);

  const target = await res.json();
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);

  await session.send('Runtime.enable');
  await session.send('Log.enable');
  await session.send('Page.enable');
  await sleep(400);

  return { session, target };
}

async function evaluate(session, expression) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description || result.exceptionDetails.text || '页面内脚本抛异常',
    );
  }

  return result.result.value;
}

async function closeSession(port, session, target) {
  session?.close();
  if (target?.id) {
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

function printMountResult(route, probe, problems) {
  const ok = route.apps.every((name) => probe.found[name]);
  const icon = ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m';

  console.log(`\n${icon} ${route.path}  \x1b[2m${route.note}\x1b[0m`);
  console.log(`   title        ${probe.title}`);
  console.log(`   env / 隔离    ${probe.env} / ${probe.isolation}`);
  console.log(`   ShadowRoot   ${probe.shadowRootCount}`);

  route.apps.forEach((name) => {
    const found = probe.found[name];
    console.log(`   ${found ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${name.padEnd(10)} 已渲染`);
  });

  if (probe.subVueConnected !== null || probe.subReactConnected !== null) {
    console.log(
      `   连接主应用    sub-vue=${probe.subVueConnected}  sub-react=${probe.subReactConnected}`,
    );
  }

  probe.hostBars.forEach((bar) => console.log(`   容器状态栏    ${bar}`));
  probe.errorMasks.forEach((mask) => console.log(`   \x1b[31m错误遮罩：${mask}\x1b[0m`));

  if (problems.length) {
    console.log(`   控制台（${problems.length} 条）：`);
    problems.slice(0, 8).forEach((p) => {
      const color = p.level === 'warning' ? '\x1b[33m' : '\x1b[31m';
      console.log(`     ${color}${p.level}\x1b[0m ${p.text}`);
    });
  }

  return ok;
}

function printCommResult(comm) {
  if (comm?.error) {
    console.log(`\n\x1b[31m✘ 通信断言失败\x1b[0m ${comm.error}`);
    return false;
  }

  const { before, after, rounds } = comm;
  const synced =
    after.main === before.main + rounds &&
    after.subVue === after.main &&
    after.subReact === after.main;
  const icon = synced ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m';

  console.log(`\n${icon} 通信断言：点主应用「count +1」×${rounds}`);
  console.log(
    `   before       main=${before.main}  sub-vue=${before.subVue}  sub-react=${before.subReact}`,
  );
  console.log(
    `   after        main=${after.main}  sub-vue=${after.subVue}  sub-react=${after.subReact}`,
  );
  console.log(
    `   ${synced ? '三个应用读到的全局状态完全一致' : '状态未同步，检查 onGlobalStateChange 是否生效'}`,
  );

  return synced;
}

async function main() {
  const missing = assertBuildsExist();
  if (missing.length) {
    console.error(`\x1b[31m[verify] 缺少构建产物：${missing.join(', ')}\x1b[0m`);
    console.error('[verify] 先执行 npm run build');
    process.exit(1);
  }

  const chrome = findChrome();
  if (!chrome) {
    console.error('[verify] 没找到 Chrome/Chromium，跳过浏览器验证。');
    console.error('[verify] 可用 CHROME_PATH 环境变量指定可执行文件路径。');
    process.exit(2);
  }

  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  /**
   * 默认验证「生产形态」：三份 dist 由本地静态服务器拼成一个站点。
   * 也可以用 VERIFY_BASE_URL 指向 dev server（http://localhost:5173），
   * 顺带把开发态的跨域 / publicPath / HMR 链路一起验了。
   */
  const externalBase = process.env.VERIFY_BASE_URL;
  const site = externalBase
    ? { url: externalBase.replace(/\/$/, ''), close: async () => {} }
    : await createStaticServer({ port: VERIFY_PORT, quiet: true });

  console.log(`[verify] 站点：${site.url}（${externalBase ? 'dev server' : '生产形态 dist'}）`);

  const chromeProcess = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,1000',
      // 受限环境（CI / 容器 / 无桌面会话）下必须关闭 Chrome 自带沙箱，
      // 否则渲染进程起不来，CDP 会"连得上但没响应"
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const chromeLogs = [];
  chromeProcess.stderr.on('data', (chunk) => chromeLogs.push(chunk.toString()));

  let exitCode = 0;

  try {
    const version = await waitForDevTools(DEBUG_PORT);
    console.log(`[verify] Chrome 就绪：${version.Browser}`);

    let failed = 0;
    let commResult = null;

    for (const route of ROUTES) {
      const url = `${site.url}${route.path}`;
      let session = null;
      let target = null;

      try {
        ({ session, target } = await openSession(DEBUG_PORT, url));
        const probe = await evaluate(session, buildMountProbe());

        if (!printMountResult(route, probe, session.collectProblems())) failed += 1;

        if (route.comm) {
          commResult = await evaluate(session, buildCommProbe());
        }
      } catch (e) {
        console.log(`\n\x1b[31m✘ ${route.path}\x1b[0m 探测失败：${e.message}`);
        failed += 1;
      } finally {
        await closeSession(DEBUG_PORT, session, target);
      }
    }

    if (commResult && !printCommResult(commResult)) failed += 1;

    console.log('\n' + '─'.repeat(66));

    if (failed) {
      console.log(`\x1b[31m[verify] ${failed} 项未通过\x1b[0m`);
      const stderr = chromeLogs
        .join('')
        .split('\n')
        .filter((l) => l && !l.includes('CVDisplayLink') && !l.includes('crashpad'))
        .slice(-6)
        .join('\n');
      if (stderr) console.log(`\x1b[2mChrome stderr:\n${stderr}\x1b[0m`);
      exitCode = 1;
    } else {
      console.log(
        `\x1b[32m[verify] ${ROUTES.length} 个路由全部通过，跨应用通信断言通过\x1b[0m`,
      );
    }
  } catch (e) {
    console.error(`\x1b[31m[verify] 失败：${e.message}\x1b[0m`);
    if (chromeLogs.length) console.error(chromeLogs.join('').slice(-1200));
    exitCode = 1;
  } finally {
    chromeProcess.kill('SIGTERM');
    await site.close();
  }

  process.exit(exitCode);
}

main();
