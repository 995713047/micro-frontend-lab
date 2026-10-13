/**
 * 子应用 A 入口 —— qiankun 生命周期实现。
 *
 * ⚠️ public-path.js 必须是第一个 import，原因见该文件注释。
 */
import './public-path';

import { createApp } from 'vue';
// 只引整份样式表（演示方便）。
// 真实项目建议用 unplugin-vue-components 做按需引入，JS 和 CSS 都能只保留用到的组件。
import 'element-plus/dist/index.css';

import App from './App.vue';
import './styles/index.css';
import { connect, disconnect } from './mfe/context';

let app = null;

/**
 * 解析挂载点。
 *
 * 为什么要多一层 shadowRoot 兜底：
 *   strictStyleIsolation 模式下，qiankun 会把子应用内容放进容器的 ShadowRoot。
 *   而 Element.querySelector() 【不会】穿透 Shadow 边界，
 *   直接 container.querySelector('#sub-vue-root') 会拿到 null，表现为白屏。
 *   这是从 experimental 切到 strict 时最容易踩的坑（README 踩坑 06）。
 */
function resolveMountNode(container) {
  const selector = '#sub-vue-root';

  if (!container) {
    return document.querySelector(selector);
  }

  return (
    container.querySelector(selector) ||
    container.shadowRoot?.querySelector(selector) ||
    null
  );
}

function render(props = {}) {
  const { container } = props;
  const mountNode = resolveMountNode(container);

  if (!mountNode) {
    throw new Error('[sub-vue] 找不到挂载点 #sub-vue-root，请检查 index.html 模板');
  }

  connect(props);

  app = createApp(App);
  // 组件在 App.vue 里按需 import，不用 app.use(ElementPlus) 全量注册 ——
  // 全量注册会把整个组件库打进产物，本项目实测体积差 3 倍以上
  app.mount(mountNode);
}

/**
 * 独立运行（直接访问 http://localhost:8081/）时不会被 qiankun 调用生命周期，
 * 需要自己启动一次 —— 这是"子应用能脱离主应用独立开发"的关键。
 */
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap() {
  // 只在首次加载时调用一次，适合做一次性的初始化（埋点注册、SDK 初始化）。
  // 官方建议这里不要做耗时操作，否则会拖慢首次渲染。
  console.log('[sub-vue] bootstrap');
}

export async function mount(props) {
  console.log('[sub-vue] mount', props);
  render(props);
}

export async function unmount() {
  console.log('[sub-vue] unmount');

  // 先解绑跨应用监听，再销毁实例，顺序反了会有一帧的写入已销毁实例
  disconnect();

  app?.unmount();
  app = null;
}
