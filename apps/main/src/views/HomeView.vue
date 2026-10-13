<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ISOLATION_MODES, ISOLATION_MODE_LABELS } from '@mfe/shared';
import { globalState } from '../micro/globalState';
import { isolationMode, theme } from '../composables/host';
import { registryInfo } from '../micro/registry';
import { getRuntimeConfig } from '../micro/runtimeConfig';

const config = getRuntimeConfig();
const apps = computed(() => registryInfo.apps);
</script>

<template>
  <h1 class="page-title">微前端实验室</h1>
  <p class="page-subtitle">
    一个主应用 + 两个子应用（Vue3 / React18），把「样式隔离」「应用通信」「独立部署」三件事
    做成可点击、可观察、可对比的实验台。
  </p>

  <div class="card">
    <h2 class="card__title">运行时架构</h2>
    <p class="card__desc">
      主应用只负责壳与编排，子应用独立开发、独立构建、独立发布。三者之间没有构建期依赖，
      只有一份通过 props 下发的运行时契约。
    </p>

    <div class="arch">
      <div class="arch__row">
        <div class="arch__box arch__box--main">
          <div class="arch__box-title">🧭 主应用（容器）</div>
          <div class="arch__box-meta">Vue3 + Vite · :5173</div>
          <div class="tiny muted" style="margin-top: 6px">
            布局 / 路由 / 微应用注册表 / 全局状态中枢 / 沙箱配置
          </div>
        </div>
      </div>

      <div class="arch__arrow">↓ loadMicroApp(name, entry, container, props)</div>

      <div class="arch__row">
        <div class="arch__box">
          <div class="arch__box-title">
            <span class="app-nav-item__dot" style="background: #41b883" />子应用 A · sub-vue
          </div>
          <div class="arch__box-meta">Vue3 + webpack5 + element-plus · :8081</div>
          <div class="tiny muted" style="margin-top: 6px">
            export bootstrap / mount / unmount
          </div>
        </div>

        <div class="arch__box">
          <div class="arch__box-title">
            <span class="app-nav-item__dot" style="background: #61dafb" />子应用 B · sub-react
          </div>
          <div class="arch__box-meta">React18 + webpack5 · :8082</div>
          <div class="tiny muted" style="margin-top: 6px">
            createRoot / unmount，验证容器与框架无关
          </div>
        </div>
      </div>

      <div class="arch__arrow">↕ props 契约（全局状态 + 事件总线 + 宿主能力）</div>

      <div class="arch__row">
        <div class="arch__box">
          <div class="arch__box-title">📦 共享协议包</div>
          <div class="arch__box-meta">@mfe/shared · workspace</div>
        </div>
        <div class="arch__box">
          <div class="arch__box-title">🛡️ qiankun 沙箱</div>
          <div class="arch__box-meta">JS 沙箱 + 样式隔离</div>
        </div>
        <div class="arch__box">
          <div class="arch__box-title">🚀 部署产物</div>
          <div class="arch__box-meta">nginx / Docker / 运行时配置</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">当前运行态</h2>
    <div class="kv">
      <span class="kv__key">环境</span>
      <span class="kv__val">{{ config.env }}</span>

      <span class="kv__key">样式隔离模式</span>
      <span class="kv__val">
        {{ ISOLATION_MODE_LABELS[isolationMode] || isolationMode }}
        <span v-if="isolationMode === ISOLATION_MODES.NONE" class="badge badge--err">存在污染风险</span>
      </span>

      <span class="kv__key">主题</span>
      <span class="kv__val">{{ theme }}</span>

      <span class="kv__key">全局状态</span>
      <span class="kv__val">{{ JSON.stringify(globalState) }}</span>

      <span class="kv__key">注册表</span>
      <span class="kv__val">
        {{ registryInfo.url || '未配置' }}
        <span class="badge" :class="registryInfo.ok ? 'badge--ok' : 'badge--warn'">
          {{ registryInfo.ok ? '远端可用' : '内联回退' }}
        </span>
      </span>

      <span class="kv__key">已发现子应用</span>
      <span class="kv__val">{{ apps.length }} 个</span>
    </div>
  </div>

  <div class="grid-3">
    <div class="card">
      <h2 class="card__title">🧪 样式隔离</h2>
      <p class="card__desc">
        两个子应用故意定义同名类（<span class="code-inline">.mfe-lab-card</span>、<span
          class="code-inline"
          >.mfe-lab-btn</span
        >），一键切换三种隔离模式对比污染效果。
      </p>
      <RouterLink class="btn btn--primary" to="/lab/isolation">进入实验室</RouterLink>
    </div>

    <div class="card">
      <h2 class="card__title">🔌 应用通信</h2>
      <p class="card__desc">
        全局状态（主题 / 计数器）、事件总线（广播消息）、宿主能力（路由跳转 / 提示）三种通道，
        全部可实时观察。
      </p>
      <RouterLink class="btn btn--primary" to="/lab/communication">进入实验室</RouterLink>
    </div>

    <div class="card">
      <h2 class="card__title">🚀 部署方案</h2>
      <p class="card__desc">
        单域名按路径、多域名独立部署两套 nginx 配置，加上 Docker 与运行时配置注入，
        做到「构建一次，多环境部署」。
      </p>
      <RouterLink class="btn btn--primary" to="/deploy">查看方案</RouterLink>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">子应用清单</h2>
    <p class="card__desc">
      清单来自运行时注册表，主应用代码里没有任何子应用地址的硬编码。
    </p>
    <div class="grid-2">
      <div v-for="app in apps" :key="app.name" class="arch__box">
        <div class="arch__box-title">
          <span class="app-nav-item__dot" :style="{ background: app.color }" />{{ app.title }}
        </div>
        <div class="arch__box-meta">{{ app.stack }}</div>
        <div class="kv" style="margin-top: 8px; grid-template-columns: 68px 1fr">
          <span class="kv__key">name</span><span class="kv__val">{{ app.name }}</span>
          <span class="kv__key">entry</span><span class="kv__val">{{ app.entry }}</span>
          <span class="kv__key">route</span><span class="kv__val">{{ app.route }}</span>
          <span class="kv__key">来源</span>
          <span class="kv__val">
            <span class="badge" :class="app.source === 'registry' ? 'badge--ok' : ''">
              {{ app.source }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
