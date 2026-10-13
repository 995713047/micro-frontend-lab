import { MFE_PROP_KEY } from '@mfe/shared';
import { createBusApi } from './eventBus';
import { getGlobalState, setGlobalState } from './globalState';
import { getRuntimeConfig } from './runtimeConfig';
import { navigate, notify } from '../composables/host';

const APP_VERSION = '1.0.0';

/**
 * 构造下发给子应用的 props。
 *
 * ⚠️ 这里【刻意不传】onGlobalStateChange / setGlobalState / offGlobalStateChange。
 *
 * 原因是读了 qiankun 2.10 的源码（node_modules/qiankun/es/loader.js:445）后发现的：
 *
 *   mount({
 *     ...你的props,
 *     container: appWrapperGetter(),
 *     setGlobalState: setGlobalState,              // ← 覆盖你的
 *     onGlobalStateChange: onGlobalStateChange,    // ← 覆盖你的
 *   });
 *
 * 这两个函数来自 qiankun 内部的 getMicroAppStateActions(appInstanceId)，
 * 也就是说：**loadMicroApp 手动加载时 qiankun 同样会自动注入，而且是"每个子应用独立 id"的版本**。
 * 网上流传的"手动模式必须自己透传全局状态函数"并不准确 —— 你传了也会被覆盖，
 * 子应用照样能用（本项目所有全局状态功能都正常工作），但你在这里写的实现是死代码。
 *
 * 唯独 offGlobalStateChange 不在覆盖之列。如果在这里把主应用的 actions 传下去，
 * 子应用一旦调用它，qiankun 内部执行的是 delete deps[主应用的id]，
 * 主应用自己的监听会被一起删掉，从此再也收不到状态变更。
 * 所以干脆不传，从源头堵掉这个坑（README 踩坑 08）。
 *
 * 也就是说，这个文件只负责【自定义宿主能力】——
 * 统一挂在 props[MFE_PROP_KEY]（默认 'mfe'）命名空间下：
 * 事件总线、路由跳转、提示、只读状态快照。
 * 约定一个固定命名空间，比往 props 顶层散落十几个字段更好维护，
 * 也不会和 qiankun 未来的官方字段冲突。
 */
export function buildMicroAppProps(appName) {
  const config = getRuntimeConfig();

  return {
    [MFE_PROP_KEY]: {
      /** 当前子应用的注册名，子应用可用它做分支逻辑 */
      appName,
      version: APP_VERSION,
      env: config.env,

      /** 事件总线（带 from 字段的受限封装） */
      bus: createBusApi(appName),

      /** 调度主应用路由：子应用里点"查看部署方案"之类的入口时用 */
      navigate,

      /** 让主应用弹一个提示 */
      notify,

      /** 只读快照：拿到的是副本，子应用改它不会影响真实状态 */
      getGlobalState,

      /** 与 setGlobalState 等价的语法糖（走主应用的 actions） */
      patchGlobalState: setGlobalState,
    },
  };
}

export { MFE_PROP_KEY };
