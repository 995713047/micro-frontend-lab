/**
 * 主子应用共享的通信协议。
 *
 * 微前端最大的隐性成本不是"怎么加载子应用"，而是"契约漂移"：
 * 主应用改了一个事件名，某个子应用没跟着改，运行时静默失效。
 * 所以把协议抽成独立 workspace 包，三端引用同一份常量，
 * 改名字时 TypeScript/编辑器能直接标红，构建期就能发现问题。
 */

/** 事件总线（mitt）事件名。命名前缀避免与业务事件冲突。 */
export const MFE_EVENTS = Object.freeze({
  /** 任意一端广播消息，三端都会收到并写入日志 */
  BROADCAST: 'mfe:broadcast',
  /** 主题变化（light / dark） */
  THEME_CHANGE: 'mfe:theme-change',
  /** 跨应用计数器变化 */
  COUNTER_CHANGE: 'mfe:counter-change',
  /** 某个子应用挂载完成 */
  APP_MOUNTED: 'mfe:app-mounted',
  /** 某个子应用卸载完成 */
  APP_UNMOUNTED: 'mfe:app-unmounted',
  /** 隔离模式切换 */
  ISOLATION_CHANGE: 'mfe:isolation-change',
});

/** qiankun initGlobalState 的全局状态字段 */
export const MFE_STATE_KEYS = Object.freeze({
  THEME: 'theme',
  COUNT: 'count',
  ISOLATION_MODE: 'isolationMode',
  LAST_BROADCAST: 'lastBroadcast',
  OPERATOR: 'operator',
});

/** 全局状态初始值。主应用 initGlobalState(INITIAL_STATE) 使用。 */
export const MFE_INITIAL_STATE = Object.freeze({
  theme: 'light',
  count: 0,
  isolationMode: 'strict',
  lastBroadcast: null,
  operator: 'main',
});

/** 样式隔离模式枚举，与 qiankun 的 sandbox 配置一一对应。 */
export const ISOLATION_MODES = Object.freeze({
  NONE: 'none',
  EXPERIMENTAL: 'experimental',
  STRICT: 'strict',
});

export const ISOLATION_MODE_LABELS = Object.freeze({
  none: '无隔离',
  experimental: 'experimentalStyleIsolation',
  strict: 'strictStyleIsolation',
});

export const ISOLATION_MODE_DESC = Object.freeze({
  none: '子应用 <style> 直接插入 document.head，全局生效，子应用之间、子应用与主应用之间会互相污染。',
  experimental: 'qiankun 给子应用每条样式规则加上 div[data-qiankun="应用名"] 前缀，靠选择器提权隔离，是"改 CSS"而非"隔离环境"。',
  strict: '子应用被包进 Shadow DOM，样式天然作用域封闭，是最彻底的方案，但 body/:root 等根选择器与部分 UI 库会失效。',
});

/** 子应用清单的稳定标识，主应用与子应用自己都用它做判断 */
export const MFE_APP_NAMES = Object.freeze({
  SUB_VUE: 'sub-vue',
  SUB_REACT: 'sub-react',
});

/** 注入到子应用 props 上的自定义字段名（非 qiankun 官方字段） */
export const MFE_PROP_KEY = 'mfe';
