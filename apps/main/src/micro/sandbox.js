import { ISOLATION_MODES } from '@mfe/shared';

/**
 * 把界面上的"隔离模式"翻译成 qiankun 的 sandbox 配置。
 *
 * qiankun 的沙箱其实有两个正交的能力：
 *   1. JS 沙箱（默认开启，无法通过这个配置关闭）：用 Proxy 包一个假的 window，
 *      快照/还原全局变量，解决子应用污染 window、卸载后残留定时器等问题。
 *   2. 样式隔离（需要显式开启，且 strict / experimental 二选一）：
 *      - strictStyleIsolation     → Shadow DOM，环境级隔离
 *      - experimentalStyleIsolation → 选择器重写加前缀，CSS 级隔离
 *
 * 所以 modes.none 并不是"完全没沙箱"，只是"没做样式隔离"，
 * 这一点很容易被误解，也是面试常问的点。
 */
export function buildSandboxConfig(mode) {
  switch (mode) {
    case ISOLATION_MODES.STRICT:
      return { strictStyleIsolation: true };

    case ISOLATION_MODES.EXPERIMENTAL:
      return { experimentalStyleIsolation: true };

    case ISOLATION_MODES.NONE:
    default:
      // 两者都关，但 JS 沙箱仍然生效（qiankun 默认 loose 沙箱）
      return {
        strictStyleIsolation: false,
        experimentalStyleIsolation: false,
      };
  }
}

/** 当前模式下样式最终注入到哪里，界面提示用 */
export function describeStyleInjection(mode) {
  switch (mode) {
    case ISOLATION_MODES.STRICT:
      return '样式被注入到子应用容器内部的 Shadow Root，与 document 完全隔离';
    case ISOLATION_MODES.EXPERIMENTAL:
      return '样式被注入到 document.head，但每条规则都被重写为带 div[data-qiankun] 前缀';
    default:
      return '样式被直接注入到 document.head，全局生效';
  }
}
