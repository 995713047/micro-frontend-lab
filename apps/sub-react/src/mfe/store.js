import { useEffect, useState } from 'react';
import { MFE_EVENTS } from '@mfe/shared';

/**
 * 子应用 B 的宿主连接状态。
 *
 * 和子应用 A 最大的区别：React 没有内置的响应式系统，
 * 所以这里自己维护一个极简的外部 store（listeners + useMfeState），
 * 用来把「主应用推过来的状态」映射成 React 的重新渲染。
 *
 * 这也是跨框架微前端的一个真实成本：
 * 容器只保证 props 送达，怎么把 props 变成框架内部的状态，
 * 是每个子应用自己的事。
 */

export const state = {
  connected: false,
  poweredByQiankun: false,
  appName: 'sub-react',
  env: 'standalone',
  mainVersion: '',
  globalState: {},
  busMessages: [],
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function patchState(partial) {
  Object.assign(state, partial);
  notifyListeners();
}

/** @type {any} */
let bridge = null;
const disposers = [];

export function connect(props = {}) {
  const mfe = props.mfe || {};
  bridge = mfe;

  patchState({
    poweredByQiankun: Boolean(window.__POWERED_BY_QIANKUN__),
    connected: Boolean(mfe.bus),
    appName: mfe.appName || 'sub-react',
    env: mfe.env || 'standalone',
    mainVersion: mfe.version || '',
  });

  // onGlobalStateChange 的第二个参数为 true：订阅时立刻用当前全量状态回调一次
  if (typeof props.onGlobalStateChange === 'function') {
    props.onGlobalStateChange((nextState) => {
      patchState({ globalState: { ...nextState } });
    }, true);
  }

  if (mfe.bus) {
    disposers.push(
      mfe.bus.on(MFE_EVENTS.BROADCAST, (event) => {
        const next = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            from: event?.from || 'unknown',
            text: event?.payload?.text ?? JSON.stringify(event?.payload ?? {}),
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          },
          ...state.busMessages,
        ].slice(0, 30);

        patchState({ busMessages: next });
      }),
    );
  }
}

export function disconnect() {
  disposers.splice(0).forEach((off) => {
    try {
      off();
    } catch (e) {
      console.warn('[sub-react] 解绑事件总线失败', e);
    }
  });

  // 同子应用 A：不调用 offGlobalStateChange()，主应用也没有下发它。
  // 主应用若透传自己的 actions，子应用调用它会删掉主应用的 listener。
  bridge = null;
  patchState({ connected: false });
}

/** React Hook：订阅 store，任何字段变化都会触发重渲染 */
export function useMfeState() {
  const [snapshot, setSnapshot] = useState({ ...state });

  useEffect(() => {
    const sync = () => setSnapshot({ ...state });
    listeners.add(sync);
    sync();
    return () => listeners.delete(sync);
  }, []);

  return snapshot;
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
