import { computed, reactive } from 'vue';
import { ISOLATION_MODES } from '@mfe/shared';
import { router } from '../router';
import { globalState, patchGlobalState } from '../micro/globalState';

/**
 * 主应用自己的"宿主能力"状态。
 *
 * 放在独立模块里是为了避免循环依赖：
 *   micro/props.js → composables/host.js → router（视图全是懒加载，不会反向依赖回来）
 */

/** 顶栏提示 */
export const toasts = reactive([]);
let toastSeq = 0;

export function notify(message, type = 'info', duration = 3200) {
  const id = (toastSeq += 1);
  toasts.push({ id, message, type });

  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

export function dismissToast(id) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) toasts.splice(index, 1);
}

/**
 * 下发给子应用的"跳转主应用路由"能力。
 * 子应用不应该直接 import 主应用的 router 实例，
 * 只通过 props 拿到一个函数，这样主应用换路由方案时子应用无感。
 */
export function navigate(path, query) {
  if (!path) return undefined;
  return router.push(query ? { path, query } : path);
}

/**
 * 隔离模式的唯一数据源是 qiankun 全局状态，
 * 这样主应用、子应用看到的一定是同一个值，
 * 不会出现"主应用切了隔离模式、子应用还以为没切"的诡异现象。
 */
export const isolationMode = computed({
  get: () => globalState.isolationMode || ISOLATION_MODES.STRICT,
  set: (mode) => patchGlobalState({ isolationMode: mode }),
});

/** 主题同样是全局状态的投影 */
export const theme = computed({
  get: () => globalState.theme,
  set: (next) => patchGlobalState({ theme: next }),
});
