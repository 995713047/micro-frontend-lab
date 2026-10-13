import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { ensureRegistry } from './micro/registry';
import { getRuntimeConfig } from './micro/runtimeConfig';
import { log } from './micro/logger';
import './styles/global.css';

const config = getRuntimeConfig();

/**
 * 启动顺序刻意做成"先拉注册表、再挂载应用"的异步流程。
 *
 * 反例：如果先 mount 主应用、再异步补子应用配置，
 * 用户在注册表返回前点到子应用菜单，会看到一次"应用未注册"的白屏闪烁。
 * 这里的取舍是：注册表请求失败会自动降级到内联配置，所以不会阻塞启动。
 */
ensureRegistry().then(({ apps, registryOk, error }) => {
  log(
    'system',
    'registry',
    registryOk
      ? `远端注册表加载成功，共 ${apps.length} 个子应用`
      : `远端注册表不可用（${error || '未配置'}），已回退内联配置，共 ${apps.length} 个子应用`,
  );
});

createApp(App).use(router).mount('#app');

log('system', 'boot', `主应用启动 · env=${config.env} · qiankun + Vue3 + Vite`);
