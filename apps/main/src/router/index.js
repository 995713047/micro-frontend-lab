import { createRouter, createWebHistory } from 'vue-router';

/**
 * 主应用使用 history 模式。
 *
 * 与之配套的部署要求：nginx 必须配 try_files $uri $uri/ /index.html，
 * 否则刷新 /sub-vue/xxx 会 404（README「部署」章节有完整配置）。
 *
 * 子应用不引入自己的 history 路由，是为了避开"主子路由互相打架"这个经典坑：
 * 子应用一旦也用 createWebHistory()，它的 base 默认是 '/'，
 * 在主应用里 push 会把主应用的地址改掉。
 * 如果子应用确实需要路由，标准做法是 createWebHistory(props.base) 或改用 hash/memory
 * （README 踩坑 09 有详细对比）。
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: '总览' },
    },
    {
      path: '/sub-vue/:pathMatch(.*)*',
      name: 'sub-vue',
      component: () => import('../views/MicroAppPage.vue'),
      meta: { title: '子应用 A · Vue3', appName: 'sub-vue' },
    },
    {
      path: '/sub-react/:pathMatch(.*)*',
      name: 'sub-react',
      component: () => import('../views/MicroAppPage.vue'),
      meta: { title: '子应用 B · React18', appName: 'sub-react' },
    },
    {
      path: '/lab/isolation',
      name: 'isolation-lab',
      component: () => import('../views/IsolationLab.vue'),
      meta: { title: '样式隔离实验室' },
    },
    {
      path: '/lab/communication',
      name: 'communication-lab',
      component: () => import('../views/CommunicationLab.vue'),
      meta: { title: '通信实验室' },
    },
    {
      path: '/deploy',
      name: 'deploy',
      component: () => import('../views/DeployView.vue'),
      meta: { title: '部署方案' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { title: '404' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const base = '微前端实验室';
  document.title = to.meta?.title ? `${to.meta.title} · ${base}` : base;
});
