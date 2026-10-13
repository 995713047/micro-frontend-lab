<script setup>
/**
 * 样式隔离实验室。
 *
 * 两个子应用都刻意写了同名类名：
 *   .mfe-lab-card / .mfe-lab-btn / .mfe-lab-title
 * 在「无隔离」模式下同时挂载，后加载的那个会覆盖先加载的样式，
 * 肉眼即可看到污染；切到 experimental / strict 后各自恢复。
 */
import { computed } from 'vue';
import { ISOLATION_MODES, ISOLATION_MODE_DESC, ISOLATION_MODE_LABELS } from '@mfe/shared';
import MicroAppHost from '../components/MicroAppHost.vue';
import { isolationMode } from '../composables/host';
import { describeStyleInjection } from '../micro/sandbox';

const mode = computed(() => isolationMode.value);

const expected = computed(() => {
  switch (mode.value) {
    case ISOLATION_MODES.STRICT:
      return [
        '两个子应用的卡片/按钮保持各自配色，互不影响',
        '子应用里给 body 写的样式不生效（Shadow DOM 内没有 body）',
        '子应用里 position: fixed 的弹层以 Shadow 宿主为包含块，可能定位异常',
        'element-plus 这类注入到 document.head 的样式需要额外处理',
      ];
    case ISOLATION_MODES.EXPERIMENTAL:
      return [
        '同名类互不影响，因为每条规则都被加了 div[data-qiankun="xxx"] 前缀',
        '子应用里的 body { } 规则依然会污染主应用（前缀只加在类/标签选择器上，根选择器管不住）',
        '动态插入的 <style> 会被 MutationObserver 捕获并重写，有轻微运行时开销',
        '样式仍在 document.head，DevTools 里能直接看到带前缀的规则',
      ];
    default:
      return [
        '两个子应用的卡片会被其中一个的配色统一覆盖 —— 这就是样式污染',
        '子应用的 body { } 会直接改掉主应用背景',
        '主应用的全局标签选择器（如 h1）也会打到子应用上',
        '因为都是"全局 CSS"，最终由加载顺序决定谁赢，非常难排查',
      ];
  }
});

const comparison = [
  {
    key: 'none',
    name: '无隔离',
    strength: '无',
    penetrate: '—',
    uiLib: '正常',
    cost: '无',
    scene: '不推荐，仅用于对比演示',
  },
  {
    key: 'experimental',
    name: 'experimentalStyleIsolation',
    strength: '中（CSS 层）',
    penetrate: '可以用自己的前缀绕过',
    uiLib: '基本正常',
    cost: '低（有 MutationObserver）',
    scene: '存量项目、用了大量全局选择器的 UI 库',
  },
  {
    key: 'strict',
    name: 'strictStyleIsolation',
    strength: '高（环境层）',
    penetrate: '需要刻意往 ShadowRoot 塞样式',
    uiLib: '要额外适配（body/:root、CSS-in-JS、弹层挂载点）',
    cost: '中（Shadow DOM + 事件重定向）',
    scene: '新项目、子应用数量多、样式冲突严重时',
  },
];

const currentRow = computed(() => comparison.find((row) => row.key === mode.value));
</script>

<template>
  <h1 class="page-title">样式隔离实验室</h1>
  <p class="page-subtitle">
    两个子应用渲染了完全一样的类名（<span class="code-inline">.mfe-lab-card</span> /
    <span class="code-inline">.mfe-lab-btn</span> /
    <span class="code-inline">.mfe-lab-title</span>），并且各自给
    <span class="code-inline">body</span> 设了背景色。切换顶栏的隔离模式，观察它们互相污染与隔离的效果。
  </p>

  <div class="card">
    <h2 class="card__title">当前模式：{{ ISOLATION_MODE_LABELS[mode] || mode }}</h2>
    <p class="card__desc">
      {{ ISOLATION_MODE_DESC[mode] }}
    </p>
    <div class="kv">
      <span class="kv__key">样式去向</span>
      <span class="kv__val">{{ describeStyleInjection(mode) }}</span>
      <span class="kv__key">JS 沙箱</span>
      <span class="kv__val">
        始终开启（qiankun 默认 Proxy 沙箱，不由这个开关控制）
      </span>
    </div>
  </div>

  <div class="grid-2">
    <MicroAppHost
      :key="`sub-vue-${mode}`"
      app-name="sub-vue"
      min-height="380px"
    />
    <MicroAppHost
      :key="`sub-react-${mode}`"
      app-name="sub-react"
      min-height="380px"
    />
  </div>

  <div class="grid-2">
    <div class="card">
      <h2 class="card__title">🔍 这个模式下你应该看到</h2>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.9">
        <li v-for="item in expected" :key="item">{{ item }}</li>
      </ul>
    </div>

    <div class="card">
      <h2 class="card__title">🧪 自己验证一遍</h2>
      <ol style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.9">
        <li>切到「无隔离」，看两个子应用卡片配色是否被统一</li>
        <li>打开 DevTools → Elements，找子应用的挂载容器：<br />
          <span class="tiny muted">
            无隔离 → 样式在 <span class="code-inline">document.head</span>；
            strict → 容器下多了一个 <span class="code-inline">#shadow-root (open)</span>
          </span>
        </li>
        <li>切到「strict」，再看一次卡片配色和页面背景</li>
        <li>观察右下角「运行时事件流」：每次切模式都会看到 unmount → mount 的完整时序</li>
      </ol>
      <p class="tiny muted" style="margin: 12px 0 0">
        提示：切模式时容器是用 <span class="code-inline">:key</span> 强制重建的，
        否则 ShadowRoot 会残留在旧容器上（README 踩坑 06）。
      </p>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">📊 三种方案横向对比</h2>
    <div style="overflow-x: auto">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid var(--mfe-border)">
            <th style="padding: 8px 10px">方案</th>
            <th style="padding: 8px 10px">隔离强度</th>
            <th style="padding: 8px 10px">样式穿透</th>
            <th style="padding: 8px 10px">第三方 UI 库</th>
            <th style="padding: 8px 10px">运行时开销</th>
            <th style="padding: 8px 10px">适用场景</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in comparison"
            :key="row.key"
            :style="{
              borderBottom: '1px solid var(--mfe-border)',
              background: row.key === mode ? 'var(--mfe-brand-soft)' : 'transparent',
            }"
          >
            <td style="padding: 8px 10px; font-weight: 600">{{ row.name }}</td>
            <td style="padding: 8px 10px">{{ row.strength }}</td>
            <td style="padding: 8px 10px">{{ row.penetrate }}</td>
            <td style="padding: 8px 10px">{{ row.uiLib }}</td>
            <td style="padding: 8px 10px">{{ row.cost }}</td>
            <td style="padding: 8px 10px">{{ row.scene }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="tiny muted" style="margin: 12px 0 0">
      当前高亮行对应你正在使用的模式。结论：<strong>{{ currentRow?.name }}</strong> ——
      {{ currentRow?.scene }}
    </p>
  </div>
</template>
