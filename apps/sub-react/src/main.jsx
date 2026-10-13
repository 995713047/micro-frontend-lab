/**
 * 子应用 B 入口 —— qiankun 生命周期实现（React 18 版）。
 *
 * ⚠️ public-path.js 必须是第一个 import。
 */
import './public-path';

import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import { connect, disconnect } from './mfe/store';

let root = null;

/**
 * 同 sub-vue：strictStyleIsolation 下容器上挂着 ShadowRoot，
 * Element.querySelector 穿不过去，需要额外兜底。
 */
function resolveMountNode(container) {
  const selector = '#sub-react-root';

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
  const mountNode = resolveMountNode(props.container);

  if (!mountNode) {
    throw new Error('[sub-react] 找不到挂载点 #sub-react-root，请检查 index.html 模板');
  }

  connect(props);

  root = createRoot(mountNode);
  root.render(<App />);
}

if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap() {
  console.log('[sub-react] bootstrap');
}

export async function mount(props) {
  console.log('[sub-react] mount', props);
  render(props);
}

export async function unmount() {
  console.log('[sub-react] unmount');

  disconnect();

  const current = root;
  root = null;

  if (!current) return;

  /**
   * React 18 的坑：直接在 qiankun 生命周期里同步调用 root.unmount()，
   * 如果此刻 React 正好在渲染中，会报
   *   "Attempted to synchronously unmount a root while React was already rendering"
   * 并把整个子应用卡死。让出一个事件循环再卸载即可（README 踩坑 12）。
   */
  await new Promise((resolve) => {
    window.setTimeout(() => {
      try {
        current.unmount();
      } catch (e) {
        console.warn('[sub-react] unmount 异常（通常是重复卸载）', e);
      }
      resolve();
    }, 0);
  });
}
