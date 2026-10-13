<script setup>
import { computed, watchEffect } from 'vue';
import { useRoute, RouterLink, RouterView } from 'vue-router';
import { ISOLATION_MODES, ISOLATION_MODE_LABELS } from '@mfe/shared';
import { globalState, patchGlobalState } from './micro/globalState';
import { isolationMode, theme } from './composables/host';
import { registryInfo } from './micro/registry';
import { getRuntimeConfig } from './micro/runtimeConfig';
import EventLogPanel from './components/EventLogPanel.vue';
import ToastHost from './components/ToastHost.vue';

const config = getRuntimeConfig();
const route = useRoute();

/** 主题落在 <html data-theme> 上，子应用也能读同一套 CSS 变量 */
watchEffect(() => {
  document.documentElement.dataset.theme = theme.value;
});

const modeOptions = [
  { value: ISOLATION_MODES.NONE, label: ISOLATION_MODE_LABELS.none },
  { value: ISOLATION_MODES.EXPERIMENTAL, label: ISOLATION_MODE_LABELS.experimental },
  { value: ISOLATION_MODES.STRICT, label: ISOLATION_MODE_LABELS.strict },
];

const subApps = computed(() => registryInfo.apps);

function switchTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
}

function setMode(mode) {
  isolationMode.value = mode;
}
</script>

<template>
  <div
    class="app-shell"
    data-mfe-main
    :data-mfe-count="globalState.count"
    :data-mfe-isolation="isolationMode"
  >
    <header class="app-header">
      <div class="app-header__brand">
        <span class="app-header__logo">MF</span>
        <span>{{ config.appTitle }}</span>
      </div>

      <span class="badge">qiankun + Vue3 + Vite</span>
      <span class="badge" :class="config.env === 'production' ? 'badge--ok' : 'badge--warn'">
        env: {{ config.env }}
      </span>
      <span
        class="badge"
        :class="registryInfo.ok ? 'badge--ok' : 'badge--warn'"
        :title="registryInfo.url || '未配置远端注册表'"
      >
        注册表：{{ registryInfo.loaded ? (registryInfo.ok ? '远端' : '内联回退') : '加载中' }}
      </span>

      <span class="app-header__spacer" />

      <div class="app-header__group">
        <span class="tiny muted">样式隔离</span>
        <div class="btn-group">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            class="btn btn--sm"
            :class="{ 'is-active': isolationMode === option.value }"
            type="button"
            @click="setMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <button class="btn btn--sm" type="button" @click="switchTheme">
        {{ theme === 'dark' ? '☀️ 亮色' : '🌙 暗色' }}
      </button>
    </header>

    <div class="app-body">
      <aside class="app-sidebar">
        <div class="app-sidebar__group-title">概览</div>
        <RouterLink
          to="/"
          class="app-nav-item"
          :class="{ 'is-active': route.name === 'home' }"
        >
          <span class="app-nav-item__dot" style="background: #6366f1" />总览
        </RouterLink>

        <div class="app-sidebar__group-title">子应用（qiankun 加载）</div>
        <RouterLink
          v-for="app in subApps"
          :key="app.name"
          :to="app.route"
          class="app-nav-item"
          :class="{ 'is-active': route.meta.appName === app.name }"
        >
          <span class="app-nav-item__dot" :style="{ background: app.color }" />
          {{ app.title }}
        </RouterLink>
        <div v-if="!subApps.length" class="app-nav-item muted tiny">注册表加载中…</div>

        <div class="app-sidebar__group-title">实验</div>
        <RouterLink
          to="/lab/isolation"
          class="app-nav-item"
          :class="{ 'is-active': route.name === 'isolation-lab' }"
        >
          <span class="app-nav-item__dot" style="background: #f59e0b" />样式隔离实验室
        </RouterLink>
        <RouterLink
          to="/lab/communication"
          class="app-nav-item"
          :class="{ 'is-active': route.name === 'communication-lab' }"
        >
          <span class="app-nav-item__dot" style="background: #10b981" />通信实验室
        </RouterLink>

        <div class="app-sidebar__group-title">工程</div>
        <RouterLink
          to="/deploy"
          class="app-nav-item"
          :class="{ 'is-active': route.name === 'deploy' }"
        >
          <span class="app-nav-item__dot" style="background: #0ea5e9" />部署方案
        </RouterLink>
        <a
          class="app-nav-item"
          href="https://github.com/995713047/micro-frontend-lab"
          target="_blank"
          rel="noreferrer"
        >
          <span class="app-nav-item__dot" style="background: #111827" />GitHub 仓库
        </a>
      </aside>

      <main class="app-main">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>
    </div>

    <EventLogPanel />
    <ToastHost />
  </div>
</template>
