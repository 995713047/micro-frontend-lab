<script setup>
/**
 * 微应用容器组件 —— 整个项目里最核心的一个文件。
 *
 * 它做三件事：
 *   1) 用 loadMicroApp 手动加载子应用（而不是 registerMicroApps 自动注册）；
 *   2) 在挂载/卸载/失败时把生命周期写进统一日志；
 *   3) 把主应用的宿主能力通过 props 下发。
 *
 * 为什么用 loadMicroApp 而不是 registerMicroApps？
 *   registerMicroApps 是"路由驱动"的自动模式，适合主应用菜单和子应用一一对应的场景。
 *   但做隔离模式切换、同屏对比两个子应用时，需要精确控制"什么时候挂、什么时候卸"，
 *   手动模式的可控性更好。qiankun 的 start() 只应调用一次，
 *   反复 start() 会注册重复的全局路由监听，这也是常见坑。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadMicroApp } from 'qiankun';
import { ISOLATION_MODE_LABELS } from '@mfe/shared';
import { buildSandboxConfig } from '../micro/sandbox';
import { buildMicroAppProps } from '../micro/props';
import { registryInfo } from '../micro/registry';
import { isolationMode } from '../composables/host';
import { log } from '../micro/logger';

const props = defineProps({
  /** 注册表里的应用名，如 sub-vue */
  appName: { type: String, required: true },
  /** 容器最小高度 */
  minHeight: { type: String, default: '260px' },
  showBar: { type: Boolean, default: true },
});

const hostRef = ref(null);
/** idle | loading | mounted | error */
const status = ref('idle');
const errorMessage = ref('');
let instance = null;

const appMeta = computed(
  () => registryInfo.apps.find((app) => app.name === props.appName) || null,
);
const entry = computed(() => appMeta.value?.entry || '');
const displayTitle = computed(() => appMeta.value?.title || props.appName);

const statusText = computed(
  () =>
    ({
      idle: '未挂载',
      loading: '加载中',
      mounted: '已挂载',
      error: '加载失败',
    })[status.value],
);

const statusBadgeClass = computed(
  () =>
    ({
      loading: 'badge--warn',
      mounted: 'badge--ok',
      error: 'badge--err',
    })[status.value] || '',
);

async function start() {
  await stop();

  if (!entry.value) {
    status.value = 'idle';
    return;
  }

  status.value = 'loading';
  errorMessage.value = '';

  const mode = isolationMode.value;
  log(props.appName, 'lifecycle', `开始加载（隔离模式：${ISOLATION_MODE_LABELS[mode] || mode}）`);
  log(props.appName, 'lifecycle', `entry = ${entry.value}`);

  try {
    instance = loadMicroApp(
      {
        name: props.appName,
        entry: entry.value,
        container: hostRef.value,
        props: buildMicroAppProps(props.appName),
      },
      {
        // 每次挂载都按当前模式构造沙箱配置：
        // 切换隔离模式时外层会用 :key 重建本组件，所以这里拿到的一定是最新值
        sandbox: buildSandboxConfig(mode),
        // 不要把子应用错误吞掉，否则排查时只能看到白屏
        singular: false,
      },
    );

    await instance.mountPromise;
    status.value = 'mounted';
    log(props.appName, 'lifecycle', 'mount 完成');
  } catch (e) {
    status.value = 'error';
    errorMessage.value = e?.message || String(e);
    log(props.appName, 'error', `加载失败：${errorMessage.value}`);
    console.error(`[mfe] ${props.appName} 加载失败`, e);
  }
}

async function stop() {
  if (!instance) return;

  // 先置空再 await，避免 unmount 过程中又触发一次 start
  const current = instance;
  instance = null;

  try {
    await current.unmount();
    log(props.appName, 'lifecycle', 'unmount 完成');
  } catch (e) {
    log(props.appName, 'error', `卸载异常：${e?.message || e}`);
  }

  if (status.value !== 'error') {
    status.value = 'idle';
  }
}

onMounted(() => {
  // 注册表可能比组件晚到（远端拉取），此时 entry 为空，
  // 下面的 watch 会在 entry 就绪后补一次挂载
  start();
});

onBeforeUnmount(() => {
  stop();
});

watch(entry, (next, prev) => {
  if (next && next !== prev) start();
});

defineExpose({ start, stop, status });
</script>

<template>
  <div class="mfe-host">
    <div v-if="showBar" class="mfe-host__bar">
      <span class="app-nav-item__dot" :style="{ background: appMeta?.color || '#94a3b8' }" />
      <span class="mfe-host__bar-title">{{ displayTitle }}</span>
      <span class="badge">{{ appName }}</span>
      <span class="badge" :class="statusBadgeClass">{{ statusText }}</span>
      <span class="app-header__spacer" />
      <span class="badge" :title="`当前隔离模式：${isolationMode}`">
        {{ ISOLATION_MODE_LABELS[isolationMode] || isolationMode }}
      </span>
      <button class="btn btn--sm" type="button" @click="start">重新挂载</button>
      <button class="btn btn--sm" type="button" @click="stop">卸载</button>
    </div>

    <div v-if="status === 'loading'" class="mfe-host__mask">
      <div>
        <p style="margin: 0 0 6px"><strong>正在加载 {{ displayTitle }}…</strong></p>
        <p class="tiny muted" style="margin: 0">{{ entry }}</p>
      </div>
    </div>

    <div v-else-if="status === 'error'" class="mfe-host__mask mfe-host__mask--error">
      <div>
        <p style="margin: 0 0 8px"><strong>子应用加载失败</strong></p>
        <pre class="code-block" style="text-align: left">{{ errorMessage }}</pre>
        <p class="tiny muted" style="margin: 0">
          排查顺序：子应用 dev server 是否启动 → entry 是否可达 → 是否放开 CORS → publicPath 是否指向子应用域名
        </p>
      </div>
    </div>

    <div
      ref="hostRef"
      class="mfe-host__container"
      :style="{ minHeight }"
    />
  </div>
</template>
