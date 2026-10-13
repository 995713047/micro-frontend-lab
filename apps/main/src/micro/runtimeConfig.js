/**
 * 读取运行时配置。
 *
 * 为什么要这一层：配置来源是 window.__MFE_CONFIG__（由 /runtime-config.js 注入），
 * 而不是 import.meta.env —— 后者在构建时就固化了，
 * 想换环境就得重新打包，与"一次构建多环境部署"的目标冲突。
 */

const FALLBACK = {
  env: 'unknown',
  appTitle: '微前端实验室',
  registryUrl: '',
  defaultIsolation: 'strict',
  apps: {},
};

export function getRuntimeConfig() {
  const injected = (typeof window !== 'undefined' && window.__MFE_CONFIG__) || {};

  return {
    ...FALLBACK,
    ...injected,
    apps: {
      ...FALLBACK.apps,
      ...(injected.apps || {}),
    },
  };
}
