import { reactive } from 'vue';

/**
 * 统一的运行时事件日志。
 *
 * 微前端最难排查的一类问题是"时序"：
 *   子应用还没 mount，主应用就 setGlobalState 了；
 *   子应用 unmount 没清干净，定时器还在往全局状态里写。
 * 把生命周期、状态变更、跨应用消息都汇总到一条时间线上，
 * 出问题时一眼就能看出是谁在什么时候做了什么。
 */

let seq = 0;

export const logs = reactive([]);

export const LOG_SOURCE_LABEL = {
  main: '主应用',
  'sub-vue': '子应用A',
  'sub-react': '子应用B',
  system: '系统',
};

export function log(source, type, detail, payload) {
  seq += 1;
  logs.unshift({
    id: seq,
    ts: Date.now(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    source,
    type,
    detail,
    payload,
  });

  // 防止长时间运行把内存吃满
  if (logs.length > 200) {
    logs.length = 200;
  }
}

export function clearLogs() {
  logs.splice(0, logs.length);
}
