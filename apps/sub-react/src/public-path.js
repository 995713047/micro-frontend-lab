/**
 * 运行时修正 webpack publicPath，必须是第一个 import。
 * 详细说明见 apps/sub-vue/src/public-path.js。
 */
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef, camelcase
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
