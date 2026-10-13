/**
 * 运行时修正 webpack publicPath。
 *
 * 为什么必须放在所有 import 之前（第一个 import）：
 *   ESM 的 import 会被提升，模块求值顺序等于 import 声明顺序。
 *   如果这个赋值晚于其他模块执行，那些模块里已经用旧 publicPath 计算出的资源地址就错了。
 *
 * qiankun 加载子应用时，会把 __INJECTED_PUBLIC_PATH_BY_QIANKUN__ 设成子应用入口的真实地址
 * （例如 http://localhost:8081/ 或 https://cdn.example.com/sub-vue/），
 * 这样按需加载的 chunk、图片、字体才会去子应用自己的域名取，而不是主应用的。
 *
 * 症状自查：DevTools Network 里看到 xxx.chunk.js 请求 404，且路径指向主应用域名
 * → 基本就是这个文件没生效或没放在最前面。
 */
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef, camelcase
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
