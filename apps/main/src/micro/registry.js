import { reactive } from 'vue';
import { getRuntimeConfig } from './runtimeConfig';

/**
 * 微应用注册表。
 *
 * 两种来源，优先级：远端 registryUrl > 内联 window.__MFE_CONFIG__.apps
 *
 * 为什么要有"远端注册表"：
 *   如果子应用地址写死在主应用代码里，那么「新增一个子应用」或「子应用换域名」
 *   都必须重新构建、重新发布主应用 —— 微前端就退化成了单体发布。
 *   把清单抽成独立的 JSON（生产上通常由发布平台/配置中心生成），
 *   主应用只需要在启动时拉一次，就能感知子应用的变化。
 *
 * 拉取失败必须能兜底，否则注册中心一挂，整个门户白屏。
 */

const REQUIRED_FIELDS = ['name', 'entry'];

function normalizeApp(raw, fallback = {}) {
  const merged = { ...fallback, ...raw };

  if (!merged.name || REQUIRED_FIELDS.some((f) => !merged[f])) {
    return null;
  }

  return {
    name: merged.name,
    title: merged.title || merged.name,
    entry: merged.entry,
    route: merged.route || `/${merged.name}`,
    activeRule: merged.activeRule || merged.route || `/${merged.name}`,
    color: merged.color || '#6366f1',
    stack: merged.stack || '',
    owner: merged.owner || '',
    /** 配置来自哪里，界面上会标出来，方便排查"为什么地址不对" */
    source: merged.source || 'inline',
  };
}

/**
 * @returns {Promise<{ apps: object[], registryOk: boolean, registryUrl: string, error?: string }>}
 */
export async function loadAppRegistry() {
  const config = getRuntimeConfig();

  /** @type {Record<string, any>} */
  const merged = {};

  // 1. 先铺内联配置兜底
  Object.values(config.apps || {}).forEach((raw) => {
    const app = normalizeApp(raw, { source: 'inline' });
    if (app) merged[app.name] = app;
  });

  let registryOk = false;
  let error = '';

  // 2. 远端注册表覆盖（只覆盖同名项，不会凭空多加应用，避免主应用被注入未知来源）
  if (config.registryUrl) {
    try {
      const res = await fetch(config.registryUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.apps;

      if (Array.isArray(list)) {
        list.forEach((raw) => {
          const fallback = merged[raw?.name] || {};
          const app = normalizeApp(raw, { ...fallback, source: 'registry' });
          if (app) merged[app.name] = app;
        });
        registryOk = true;
      }
    } catch (e) {
      error = e?.message || String(e);
      // 静默降级：注册中心不可用不应阻塞主应用启动
      console.warn(`[mfe] 远端注册表拉取失败，已回退到内联配置：${error}`);
    }
  }

  return {
    apps: Object.values(merged),
    registryOk,
    registryUrl: config.registryUrl,
    error,
  };
}

/** 注册表未加载完成时的同步快照，供不关心动态性的组件使用 */
export const appMapFrom = (apps) =>
  apps.reduce((acc, app) => {
    acc[app.name] = app;
    return acc;
  }, {});

/** 注册表加载状态（响应式），界面直接渲染 */
export const registryInfo = reactive({
  loaded: false,
  ok: false,
  url: '',
  error: '',
  /** @type {ReturnType<typeof normalizeApp>[]} */
  apps: [],
});

let pending = null;

/**
 * 单例加载：多处调用只会真正请求一次。
 * 主应用启动时调用，视图里 await 它即可拿到结果。
 */
export function ensureRegistry() {
  if (!pending) {
    pending = loadAppRegistry().then((result) => {
      registryInfo.loaded = true;
      registryInfo.ok = result.registryOk;
      registryInfo.url = result.registryUrl;
      registryInfo.error = result.error || '';
      registryInfo.apps = result.apps;
      return result;
    });
  }
  return pending;
}

export function getAppByName(name) {
  return registryInfo.apps.find((app) => app.name === name) || null;
}
