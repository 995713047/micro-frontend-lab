<script setup>
/**
 * 运行时事件流抽屉。
 *
 * 把「微应用生命周期 + qiankun 全局状态变更 + 事件总线消息」汇总成一条时间线。
 * 微前端的问题九成出在时序上，这个面板基本能覆盖日常排查。
 */
import { computed, ref } from 'vue';
import { clearLogs, logs, LOG_SOURCE_LABEL } from '../micro/logger';

const open = ref(false);

const counts = computed(() => {
  const acc = {};
  logs.forEach((row) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
  });
  return acc;
});

function labelOf(source) {
  return LOG_SOURCE_LABEL[source] || source;
}
</script>

<template>
  <div class="log-drawer">
    <div class="log-drawer__head">
      <span>运行时事件流</span>
      <span class="badge">{{ logs.length }}</span>
      <span class="app-header__spacer" />
      <button class="btn btn--sm" type="button" @click="clearLogs">清空</button>
      <button class="btn btn--sm" type="button" @click="open = !open">
        {{ open ? '收起' : '展开' }}
      </button>
    </div>

    <div v-show="open" class="log-drawer__body">
      <div v-if="!logs.length" class="log-row">
        <span class="log-row__detail muted">暂无事件。切换子应用或操作通信实验室试试。</span>
      </div>
      <div v-for="row in logs" :key="row.id" class="log-row">
        <span class="log-row__time">{{ row.time }}</span>
        <span class="log-row__source">{{ labelOf(row.source) }}</span>
        <span class="log-row__detail">
          <span class="log-row__type">[{{ row.type }}]</span> {{ row.detail }}
        </span>
      </div>
    </div>
  </div>
</template>
