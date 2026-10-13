import { reactive } from 'vue';
import { MFE_EVENTS } from '@mfe/shared';

/**
 * 子应用侧的"宿主连接"状态。
 *
 * 子应用不应该去 import 主应用的任何模块（那会产生构建期耦合，
 * 主应用一改子应用就得跟着改）。所有跨应用能力都从 mount(props) 里拿。
 *
 * 独立运行（不走 qiankun，直接访问 :8081）时，bridge 为 null，
 * 组件里的 connected 会是 false，界面会自动降级 —— 这也是子应用必须做到的能力：
 * 能独立开发、独立调试，不被主应用绑架。
 */

export const context = reactive({
  /** 是否拿到了主应用下发的宿主能力 */
  connected: false,
  /** 是否运行在 qiankun 容器里 */
  poweredByQiankun: false,
  appName: 'sub-vue',
  env: 'standalone',
  mainVersion: '',
  /** 来自 qiankun initGlobalState 的全局状态快照 */
  globalState: {},
  /** 通过事件总线收到的广播 */
  busMessages: [],
});

/** @type {any} */
let bridge = null;
/** 事件总线解绑函数集合 */
const disposers = [];

export function connect(props = {}) {
  const mfe = props.mfe || {};
  bridge = mfe;

  context.poweredByQiankun = Boolean(window.__POWERED_BY_QIANKUN__);
  context.connected = Boolean(mfe.bus);
  context.appName = mfe.appName || 'sub-vue';
  context.env = mfe.env || 'standalone';
  context.mainVersion = mfe.version || '';

  // qiankun 官方全局状态。第二个参数 true = 立即用当前全量状态回调一次，
  // 这样子应用一挂载就能拿到主题/语言等已有值，不需要主应用再补推一次。
  if (typeof props.onGlobalStateChange === 'function') {
    props.onGlobalStateChange((state) => {
      context.globalState = { ...state };
    }, true);
  }

  if (mfe.bus) {
    disposers.push(
      mfe.bus.on(MFE_EVENTS.BROADCAST, (event) => {
        context.busMessages.unshift({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: event?.from || 'unknown',
          text: event?.payload?.text ?? JSON.stringify(event?.payload ?? {}),
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        });
        if (context.busMessages.length > 30) context.busMessages.length = 30;
      }),
    );
  }
}

export function disconnect() {
  // 解绑自己注册的事件总线监听，否则子应用卸载后监听还在，
  // 下一次广播会写进已经销毁的响应式对象（README 踩坑 11）。
  disposers.splice(0).forEach((off) => {
    try {
      off();
    } catch (e) {
      console.warn('[sub-vue] 解绑事件总线失败', e);
    }
  });

  // 注意：这里刻意不调用 offGlobalStateChange()，主应用也没有把它下发下来。
  // 原因见 apps/main/src/micro/props.js 的注释：
  // 主应用若把自己的 actions 透传下来，子应用调用 offGlobalStateChange 会
  // delete 掉【主应用】的 listener，导致主应用再也收不到状态变更。
  bridge = null;
  context.connected = false;
}

export function setGlobalState(patch) {
  bridge?.patchGlobalState?.(patch);
}

export function emit(channel, payload) {
  bridge?.bus?.emit(channel, payload);
}

export function navigate(path) {
  bridge?.navigate?.(path);
}

export function notify(message, type) {
  bridge?.notify?.(message, type);
}
