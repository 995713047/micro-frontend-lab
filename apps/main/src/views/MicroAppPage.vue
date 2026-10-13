<script setup>
/**
 * 单个子应用的独立页面。
 *
 * 注意 :key 里拼了 isolationMode：
 * 隔离模式一变，Vue 会销毁并重建整个 MicroAppHost，
 * 于是得到一个全新的 DOM 容器。
 *
 * 为什么必须这样：strictStyleIsolation 会把渲染结果放进容器的 ShadowRoot，
 * 如果复用同一个容器元素，切换模式时旧的 ShadowRoot 还挂在上面，
 * 会出现"切回无隔离后样式仍然是隔离的"这种灵异现象。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MicroAppHost from '../components/MicroAppHost.vue';
import { isolationMode } from '../composables/host';
import { ISOLATION_MODE_DESC, ISOLATION_MODE_LABELS } from '@mfe/shared';

const route = useRoute();
const appName = computed(() => route.meta.appName);
</script>

<template>
  <h1 class="page-title">{{ route.meta.title }}</h1>
  <p class="page-subtitle">
    这块区域完全由子应用自己渲染，主应用只提供了一个容器 DOM。
    子应用切换内部页签不会影响主应用路由。
  </p>

  <div class="card">
    <div class="card__title">
      当前隔离模式：{{ ISOLATION_MODE_LABELS[isolationMode] || isolationMode }}
    </div>
    <p class="card__desc" style="margin-bottom: 0">
      {{ ISOLATION_MODE_DESC[isolationMode] }}
    </p>
  </div>

  <MicroAppHost
    :key="`${appName}-${isolationMode}`"
    :app-name="appName"
    min-height="520px"
  />
</template>
