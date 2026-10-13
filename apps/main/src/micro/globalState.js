import { reactive } from 'vue';
import { initGlobalState } from 'qiankun';
import { MFE_INITIAL_STATE } from '@mfe/shared';
import { log } from './logger';
import { getRuntimeConfig } from './runtimeConfig';

/**
 * qiankun 官方全局状态。
 *
 * 特点与限制（面试高频）：
 *   - 它是一个「发布订阅 + 全量快照」的模型：setGlobalState 只做浅合并，不做深比较，
 *     所以不要往里塞大对象，一次变更会广播给所有订阅者，性能敏感数据建议自己走事件总线。
 *   - setGlobalState 只接受 initGlobalState 时【声明过】的第一层字段，
 *     没声明过的 key 会被忽略并打一条 "[qiankun] 'xxx' not declared when init state" 警告。
 *   - 每个子应用只能有一个生效的监听，重复 onGlobalStateChange 会覆盖（qiankun 内部按 id 存储）。
 */

/**
 * 初始状态里，隔离模式来自运行时配置。
 *
 * ⚠️ 这里踩过一次：一开始只把 defaultIsolation 写进了 runtime-config.js，
 * 但全局状态里硬编码了 'strict'，结果改环境变量完全没效果 ——
 * 配置写了不等于生效，必须有代码真的读它。
 * 这也是 npm run verify 抓出来的问题：MFE_ISOLATION=none 时 ShadowRoot 依然是 2。
 */
const runtimeConfig = getRuntimeConfig();

const initState = {
  ...MFE_INITIAL_STATE,
  isolationMode: runtimeConfig.defaultIsolation || MFE_INITIAL_STATE.isolationMode,
};

/** 主应用自己持有的响应式副本，用于渲染 UI */
export const globalState = reactive({ ...initState });

/** qiankun 的 actions，主应用侧用它来读写全局状态 */
export const globalStateActions = initGlobalState({ ...initState });

const { onGlobalStateChange, setGlobalState, offGlobalStateChange } = globalStateActions;

onGlobalStateChange((state, prevState) => {
  Object.assign(globalState, state);

  const changed = Object.keys(state).filter((key) => state[key] !== prevState[key]);
  if (changed.length) {
    log('main', 'globalState', `状态变更：${changed.join(', ')}`);
  }
}, true);

export { onGlobalStateChange, setGlobalState, offGlobalStateChange };

/** 主应用侧更新状态（子应用请使用 props 里透传的 setGlobalState） */
export function patchGlobalState(patch) {
  setGlobalState(patch);
}

export function getGlobalState() {
  return { ...globalState };
}
