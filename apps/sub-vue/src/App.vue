<script setup>
/**
 * 子应用 A 的界面。
 *
 * 三个能力都在这里可点可看：
 *   - 读/写 qiankun 全局状态（主题、计数器）
 *   - 往事件总线发广播、收广播
 *   - 反向调用主应用下发的宿主能力（路由跳转、弹提示）
 */
import { computed, ref } from 'vue';
import { ElAlert, ElButton, ElProgress, ElTag } from 'element-plus';
import { MFE_EVENTS } from '@mfe/shared';
import { context, emit, navigate, notify, setGlobalState } from './mfe/context';

const tab = ref('overview');
const draft = ref('来自子应用 A 的广播消息');

const globalState = computed(() => context.globalState || {});
const count = computed(() => Number(globalState.value.count ?? 0));
const theme = computed(() => globalState.value.theme ?? '未知');

/** 进度条纯粹为了展示 element-plus 的样式在三种隔离模式下的表现 */
const progress = computed(() => Math.min(100, Math.abs(count.value) * 10));

const stateJson = computed(() => JSON.stringify(globalState.value, null, 2));

function changeCount(delta) {
  setGlobalState({ count: count.value + delta, operator: context.appName });
}

function broadcast() {
  const text = draft.value.trim();
  if (!text) return;
  emit(MFE_EVENTS.BROADCAST, { text });
  draft.value = '';
}

function requestHostNavigate() {
  navigate('/deploy');
}

function requestHostNotify() {
  notify('这条提示是子应用 A 通过 props.mfe.notify 让主应用弹出来的', 'success');
}
</script>

<template>
  <!-- data-* 属性供 scripts/verify.mjs 做端到端断言，无副作用 -->
  <div
    class="sv-root"
    :data-mfe-count="count"
    :data-mfe-connected="String(context.connected)"
  >
    <div class="sv-head">
      <span class="sv-pill">子应用 A</span>
      <span class="sv-pill">Vue 3 + element-plus</span>
      <span class="sv-pill" :class="context.poweredByQiankun ? '' : 'sv-pill--warn'">
        {{ context.poweredByQiankun ? 'qiankun 容器内' : '独立运行' }}
      </span>
      <span class="sv-pill" :class="context.connected ? '' : 'sv-pill--warn'">
        {{ context.connected ? '已连接主应用' : '未拿到宿主 props' }}
      </span>
    </div>

    <!-- 故意使用通用类名，用于样式隔离对比 -->
    <div class="mfe-lab-card">
      <h3 class="mfe-lab-title">⚠️ 样式污染演示卡片（子应用 A）</h3>
      <p style="margin: 0 0 10px">
        这个卡片用的是 <code>.mfe-lab-card</code>，子应用 B 里有一模一样的类名。
        在「无隔离」模式下，两边的配色会互相覆盖。
      </p>
      <button class="mfe-lab-btn" type="button" @click="broadcast">通用类名按钮</button>
      <button class="mfe-lab-btn mfe-lab-btn--ghost" type="button" style="margin-left: 8px">
        次要按钮
      </button>
    </div>

    <div class="sv-tabs">
      <button
        v-for="item in [
          { key: 'overview', label: '概览' },
          { key: 'state', label: '全局状态' },
          { key: 'bus', label: '事件总线' },
          { key: 'host', label: '宿主能力' },
        ]"
        :key="item.key"
        class="sv-tab"
        :class="{ 'is-active': tab === item.key }"
        type="button"
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <template v-if="tab === 'overview'">
      <div class="sv-kv">
        <span class="sv-kv__key">应用名</span><span class="sv-kv__val">{{ context.appName }}</span>
        <span class="sv-kv__key">环境</span><span class="sv-kv__val">{{ context.env }}</span>
        <span class="sv-kv__key">主应用版本</span>
        <span class="sv-kv__val">{{ context.mainVersion || '—' }}</span>
        <span class="sv-kv__key">挂载点</span>
        <span class="sv-kv__val">#sub-vue-root</span>
      </div>
      <ElAlert
        type="success"
        :closable="false"
        show-icon
        title="我是独立构建、独立部署的 Vue3 应用"
        description="主应用只给我一个容器 DOM 和一份 props 契约，剩下全部由我自己决定。"
      />
    </template>

    <template v-else-if="tab === 'state'">
      <p style="margin: 0 0 10px">
        当前全局状态里的 <code>count</code> = <strong>{{ count }}</strong>，来自
        <code>{{ globalState.operator || '—' }}</code> 的操作。
      </p>
      <div class="sv-row">
        <ElButton type="primary" size="small" @click="changeCount(1)">子应用 A count +1</ElButton>
        <ElButton size="small" @click="changeCount(-1)">子应用 A count −1</ElButton>
      </div>
      <div style="margin-bottom: 10px">
        <ElProgress :percentage="progress" :stroke-width="10" color="#41b883" />
      </div>
      <div class="sv-kv">
        <span class="sv-kv__key">theme</span><span class="sv-kv__val">{{ theme }}</span>
      </div>
      <pre
        style="
          margin: 0;
          padding: 10px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #cbe9dc;
          font-size: 11.5px;
          max-height: 150px;
          overflow: auto;
        "
        >{{ stateJson }}</pre
      >
    </template>

    <template v-else-if="tab === 'bus'">
      <div class="sv-row">
        <input v-model="draft" class="sv-input" placeholder="输入广播内容" @keyup.enter="broadcast" />
        <button class="mfe-lab-btn" type="button" @click="broadcast">广播到三端</button>
      </div>
      <p style="margin: 0 0 6px">
        收到的广播（{{ context.busMessages.length }} 条）：
      </p>
      <div class="sv-log">
        <div v-if="!context.busMessages.length" style="color: #6b9c85">
          还没有收到消息。可以在主应用或子应用 B 里发一条试试。
        </div>
        <div v-for="message in context.busMessages" :key="message.id" class="sv-log__row">
          <span class="sv-pill">{{ message.from }}</span>
          <span style="color: #6b9c85; margin: 0 6px">{{ message.time }}</span>
          {{ message.text }}
        </div>
      </div>
    </template>

    <template v-else>
      <p style="margin: 0 0 10px">
        下面两个按钮都是「子应用反向调用主应用」——通过 <code>props.mfe</code> 拿到的方法，
        而不是 import 主应用的模块。
      </p>
      <div class="sv-row">
        <ElButton type="primary" size="small" @click="requestHostNotify">
          让主应用弹一个提示
        </ElButton>
        <ElButton size="small" @click="requestHostNavigate">
          让主应用跳到「部署方案」
        </ElButton>
      </div>
      <ElTag type="success" effect="plain">props.mfe.notify / props.mfe.navigate</ElTag>
    </template>
  </div>
</template>
