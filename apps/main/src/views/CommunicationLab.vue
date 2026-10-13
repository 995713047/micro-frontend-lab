<script setup>
/**
 * 通信实验室。
 *
 * 三条通道同时演示，主应用和三端日志共用一条时间线：
 *   1) qiankun 全局状态  —— 主题、计数器（有"当前值"，新应用订阅即得全量快照）
 *   2) 事件总线（mitt）  —— 一次性广播（没有"当前值"，错过就没了）
 *   3) 宿主能力          —— 子应用反向调用主应用的导航/提示
 */
import { computed, ref } from 'vue';
import { MFE_EVENTS, ISOLATION_MODE_LABELS } from '@mfe/shared';
import MicroAppHost from '../components/MicroAppHost.vue';
import { globalState, patchGlobalState } from '../micro/globalState';
import { busMessages, createBusApi } from '../micro/eventBus';
import { isolationMode } from '../composables/host';

const mode = computed(() => isolationMode.value);
const bus = createBusApi('main');

const draft = ref('大家好，我是主应用 👋');

function changeCount(delta) {
  patchGlobalState({ count: (globalState.count || 0) + delta, operator: 'main' });
}

function toggleTheme() {
  patchGlobalState({ theme: globalState.theme === 'dark' ? 'light' : 'dark' });
}

function sendBroadcast() {
  const text = draft.value.trim();
  if (!text) return;
  bus.emit(MFE_EVENTS.BROADCAST, { text });
  draft.value = '';
}

function formatPayload(payload) {
  if (payload === undefined || payload === null) return '';
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}
</script>

<template>
  <h1 class="page-title">通信实验室</h1>
  <p class="page-subtitle">
    主应用与两个子应用同时在线。下面每个操作都会广播到三端，右下角的运行时事件流会记录全过程。
  </p>

  <div class="grid-2">
    <div class="card">
      <h2 class="card__title">① qiankun 全局状态（initGlobalState）</h2>
      <p class="card__desc">
        有"当前值"的共享数据。新挂载的子应用通过
        <span class="code-inline">onGlobalStateChange(cb, true)</span> 立刻拿到全量快照。
      </p>

      <div class="kv">
        <span class="kv__key">count</span>
        <span class="kv__val">{{ globalState.count }}</span>
        <span class="kv__key">theme</span>
        <span class="kv__val">{{ globalState.theme }}</span>
        <span class="kv__key">operator</span>
        <span class="kv__val">{{ globalState.operator }}</span>
        <span class="kv__key">isolationMode</span>
        <span class="kv__val">{{ ISOLATION_MODE_LABELS[globalState.isolationMode] }}</span>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap">
        <button class="btn btn--primary btn--sm" type="button" @click="changeCount(1)">
          主应用 count +1
        </button>
        <button class="btn btn--sm" type="button" @click="changeCount(-1)">
          主应用 count −1
        </button>
        <button class="btn btn--sm" type="button" @click="toggleTheme">
          主应用切换主题
        </button>
      </div>
    </div>

    <div class="card">
      <h2 class="card__title">② 事件总线（mitt 发布订阅）</h2>
      <p class="card__desc">
        一次性的"通知"，没有当前值。适合 <span class="code-inline">做了一步操作，通知别人刷新</span>
        这类场景，不放进全局状态可以避免无谓的全量广播。
      </p>

      <div style="display: flex; gap: 8px">
        <input
          v-model="draft"
          class="mfe-input"
          style="
            flex: 1;
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid var(--mfe-border);
            background: var(--mfe-surface);
            color: var(--mfe-text);
            font-family: inherit;
            font-size: 13px;
          "
          placeholder="输入要广播的消息"
          @keyup.enter="sendBroadcast"
        />
        <button class="btn btn--primary btn--sm" type="button" @click="sendBroadcast">
          广播
        </button>
      </div>

      <div class="tiny muted" style="margin-top: 10px">
        主应用收到的广播（最新 6 条，完整记录见右下角事件流）：
      </div>
      <div style="margin-top: 6px; max-height: 132px; overflow-y: auto">
        <div v-if="!busMessages.length" class="tiny muted">暂无消息，试试点上面的「广播」</div>
        <div
          v-for="message in busMessages.slice(0, 6)"
          :key="message.id"
          class="tiny"
          style="padding: 3px 0; border-bottom: 1px dashed var(--mfe-border)"
        >
          <span class="badge badge--brand">{{ message.from }}</span>
          <span class="muted" style="margin: 0 6px">{{ message.time }}</span>
          <span class="code-inline">{{ message.channel }}</span>
          <span style="margin-left: 6px">{{ formatPayload(message.payload) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <MicroAppHost :key="`sub-vue-${mode}`" app-name="sub-vue" min-height="420px" />
    <MicroAppHost :key="`sub-react-${mode}`" app-name="sub-react" min-height="420px" />
  </div>

  <div class="card">
    <h2 class="card__title">③ 三种通信方式怎么选</h2>
    <div style="overflow-x: auto">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid var(--mfe-border)">
            <th style="padding: 8px 10px">方式</th>
            <th style="padding: 8px 10px">载体</th>
            <th style="padding: 8px 10px">有"当前值"</th>
            <th style="padding: 8px 10px">典型场景</th>
            <th style="padding: 8px 10px">注意点</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid var(--mfe-border)">
            <td style="padding: 8px 10px; font-weight: 600">props 下发</td>
            <td style="padding: 8px 10px">qiankun 挂载参数</td>
            <td style="padding: 8px 10px">有（快照）</td>
            <td style="padding: 8px 10px">主 → 子单向下发能力、配置</td>
            <td style="padding: 8px 10px">子应用无法反向修改，天然安全</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--mfe-border)">
            <td style="padding: 8px 10px; font-weight: 600">全局状态</td>
            <td style="padding: 8px 10px">initGlobalState</td>
            <td style="padding: 8px 10px">有</td>
            <td style="padding: 8px 10px">主题、用户信息、语言</td>
            <td style="padding: 8px 10px">浅合并、全量广播；别放大对象</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; font-weight: 600">事件总线</td>
            <td style="padding: 8px 10px">mitt / EventTarget</td>
            <td style="padding: 8px 10px">无</td>
            <td style="padding: 8px 10px">操作通知、局部刷新</td>
            <td style="padding: 8px 10px">必须在 unmount 时解绑，否则内存泄漏</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="tiny muted" style="margin: 12px 0 0">
      如果子应用需要跨标签页通信，可以把事件总线换成
      <span class="code-inline">BroadcastChannel</span>；如果子应用域名完全不受控（第三方接入），
      则应该退化成 <span class="code-inline">postMessage</span>。
    </p>
  </div>
</template>
