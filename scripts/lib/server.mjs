import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SCRIPTS_DIR, '../..');

export const DIST_DIRS = {
  main: path.join(ROOT, 'apps/main/dist'),
  'sub-vue': path.join(ROOT, 'apps/sub-vue/dist'),
  'sub-react': path.join(ROOT, 'apps/sub-react/dist'),
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function readEnvConfig() {
  const pick = (key, fallback) =>
    process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key];

  return {
    env: pick('MFE_ENV', 'production-sim'),
    appTitle: pick('MFE_APP_TITLE', '微前端实验室'),
    isolation: pick('MFE_ISOLATION', 'strict'),
    subVueEntry: pick('SUB_VUE_ENTRY', '/sub-vue/'),
    subReactEntry: pick('SUB_REACT_ENTRY', '/sub-react/'),
    // 允许显式置空来验证「注册表不可用时回退内联配置」这条降级路径
    registryUrl: process.env.MFE_REGISTRY_URL === undefined ? '/apps.json' : process.env.MFE_REGISTRY_URL,
  };
}

/**
 * 生成 /runtime-config.js —— 与容器里 deploy/entrypoint.sh 做的事情完全一致。
 * 这样本地 npm run serve 就能验证生产环境的运行时配置注入链路。
 */
function buildRuntimeConfigScript() {
  const cfg = readEnvConfig();

  return `/* 由 scripts/lib/server.mjs 运行时生成，等价于容器里的 deploy/entrypoint.sh */
window.__MFE_CONFIG__ = {
  env: ${JSON.stringify(cfg.env)},
  appTitle: ${JSON.stringify(cfg.appTitle)},
  registryUrl: ${JSON.stringify(cfg.registryUrl)},
  defaultIsolation: ${JSON.stringify(cfg.isolation)},
  apps: {
    "sub-vue": {
      name: "sub-vue",
      title: "子应用 A · Vue3",
      entry: ${JSON.stringify(cfg.subVueEntry)},
      route: "/sub-vue",
      color: "#41b883",
      stack: "Vue 3 + webpack5 + element-plus"
    },
    "sub-react": {
      name: "sub-react",
      title: "子应用 B · React18",
      entry: ${JSON.stringify(cfg.subReactEntry)},
      route: "/sub-react",
      color: "#61dafb",
      stack: "React 18 + webpack5"
    }
  }
};
`;
}

function buildRegistryJson() {
  const cfg = readEnvConfig();

  return JSON.stringify(
    {
      version: '1.0.0',
      generatedBy: 'scripts/lib/server.mjs',
      apps: [
        {
          name: 'sub-vue',
          title: '子应用 A · Vue3',
          entry: cfg.subVueEntry,
          route: '/sub-vue',
          activeRule: '/sub-vue',
          color: '#41b883',
          stack: 'Vue 3 + webpack5 + element-plus',
          owner: 'team-vue',
        },
        {
          name: 'sub-react',
          title: '子应用 B · React18',
          entry: cfg.subReactEntry,
          route: '/sub-react',
          activeRule: '/sub-react',
          color: '#61dafb',
          stack: 'React 18 + webpack5',
          owner: 'team-react',
        },
      ],
    },
    null,
    2,
  );
}

function sendBuffer(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type,
    // 模拟"index.html 不缓存、静态资源长缓存"的生产策略
    'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      sendBuffer(res, 404, `Not Found: ${filePath}`, 'text/plain; charset=utf-8');
      return;
    }
    sendBuffer(res, 200, buf, type);
  });
}

/** 把 URL 路径安全地映射到磁盘路径，拒绝 ../ 逃逸 */
function safeJoin(baseDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.posix.normalize(decoded);
  const target = path.join(baseDir, normalized);
  const base = path.resolve(baseDir);

  if (!path.resolve(target).startsWith(base)) return null;
  return target;
}

/**
 * 本地模拟生产部署的静态服务器。
 *
 * 路由规则刻意与 deploy/nginx.conf 保持一致：
 *   /              → 主应用（SPA fallback 到 index.html）
 *   /sub-vue/      → 子应用 A 产物
 *   /sub-react/    → 子应用 B 产物
 *   /runtime-config.js、/apps.json → 运行时生成
 */
export function createStaticServer({ port = 4173, host = '127.0.0.1', quiet = false } = {}) {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath === '/runtime-config.js') {
      sendBuffer(res, 200, buildRuntimeConfigScript(), 'application/javascript; charset=utf-8');
      return;
    }

    if (urlPath === '/apps.json') {
      sendBuffer(res, 200, buildRegistryJson(), 'application/json; charset=utf-8');
      return;
    }

    // 子应用：按路径前缀映射到各自的 dist
    for (const name of ['sub-vue', 'sub-react']) {
      const prefix = `/${name}/`;
      if (urlPath === prefix || urlPath.startsWith(prefix)) {
        const rest = urlPath.slice(prefix.length) || 'index.html';
        const target = safeJoin(DIST_DIRS[name], rest);

        if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
          sendFile(res, target);
          return;
        }

        // 子应用自己的 SPA fallback
        sendFile(res, path.join(DIST_DIRS[name], 'index.html'));
        return;
      }
    }

    // 主应用
    const target = safeJoin(DIST_DIRS.main, urlPath === '/' ? '/index.html' : urlPath);

    if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
      sendFile(res, target);
      return;
    }

    // history 路由回退，等价于 nginx 的 try_files $uri $uri/ /index.html
    sendFile(res, path.join(DIST_DIRS.main, 'index.html'));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      if (!quiet) {
        console.log(`[serve] http://${host}:${port}  （等价于 nginx 单域名按路径部署）`);
      }
      resolve({
        port,
        host,
        url: `http://${host}:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

export function assertBuildsExist() {
  const missing = Object.entries(DIST_DIRS)
    .filter(([, dir]) => !fs.existsSync(path.join(dir, 'index.html')))
    .map(([name]) => name);

  return missing;
}
