import { reactive } from 'vue';
import mitt from 'mitt';
import { MFE_EVENTS } from '@mfe/shared';
import { log } from './logger';

/**
 * 跨应用事件总线（发布订阅）。
 *
 * 与 qiankun 全局状态的分工：
 *   - 全局状态：低频、需要"当前值"的共享数据（主题、用户、语言）。
 *     新挂载的子应用订阅一次就能拿到全量快照。
 *   - 事件总线：高频、一次性的"通知"（某个按钮被点了、某个请求失败了）。
 *     没有"当前值"的概念，错过了就错过了。
 *
 * 实现上就是一个 mitt 实例，通过 props 透传给子应用，
 * 所以三个应用引用的是同一个对象，天然互通。
 */

export const eventBus = mitt();

/** 记录通过总线流转的消息，供"通信实验室"页面展示 */
export const busMessages = reactive([]);

export function publishBusMessage({ from, channel, payload }) {
  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from,
    channel,
    payload,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  };

  busMessages.unshift(message);
  if (busMessages.length > 100) busMessages.length = 100;

  return message;
}

// 主应用自己也订阅所有事件，写入统一日志（mitt 的 '*' 通配符）
eventBus.on('*', (type, event) => {
  const from = event?.from || 'unknown';
  log(from, 'eventBus', `${type}`, event?.payload);
});

/**
 * 暴露给子应用的受限 API。
 * 不直接把 mitt 实例丢过去，是为了：
 *   1) 强制带上 from 字段，日志里能看清是谁发的；
 *   2) 后续想换成 BroadcastChannel / postMessage 时，子应用不用改代码。
 */
export function createBusApi(selfName) {
  return {
    emit(channel, payload) {
      const event = { from: selfName, payload, ts: Date.now() };
      publishBusMessage({ from: selfName, channel, payload });
      eventBus.emit(channel, event);
      eventBus.emit(MFE_EVENTS.BROADCAST, event);
    },
    on(channel, handler) {
      eventBus.on(channel, handler);
      return () => eventBus.off(channel, handler);
    },
    off(channel, handler) {
      eventBus.off(channel, handler);
    },
  };
}
