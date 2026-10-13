/**
 * 运行时配置（默认值 / 本地开发用）。
 *
 * 这个文件不是被打包进 bundle 的，而是作为静态文件放在 dist 根目录，
 * 由 index.html 用 <script src="/runtime-config.js"> 同步加载。
 * 容器启动时 entrypoint.sh 会用环境变量重新生成它。
 *
 * 收益：同一个镜像可以部署到 dev / staging / prod，
 * 只改环境变量即可切换子应用地址，不需要重新构建（README「部署」章节）。
 */
window.__MFE_CONFIG__ = {
  /** 当前环境标识，仅用于展示 */
  env: 'development',

  /** 应用名称，展示在顶栏 */
  appTitle: '微前端实验室',

  /**
   * 远端微应用注册表地址。
   * 主应用启动时会先 fetch 这个 JSON；失败则回退到下面的 apps 内联配置。
   * 生产实践里这个文件由发布系统生成，主应用因此不需要为"新增一个子应用"而重新发版。
   */
  registryUrl: '/apps.json',

  /** 默认样式隔离模式：none | experimental | strict */
  defaultIsolation: 'strict',

  /** 子应用内联配置（注册表拉取失败时的兜底） */
  apps: {
    'sub-vue': {
      name: 'sub-vue',
      title: '子应用 A · Vue3',
      entry: 'http://localhost:8081/',
      route: '/sub-vue',
      color: '#41b883',
      stack: 'Vue 3 + webpack5 + element-plus',
    },
    'sub-react': {
      name: 'sub-react',
      title: '子应用 B · React18',
      entry: 'http://localhost:8082/',
      route: '/sub-react',
      color: '#61dafb',
      stack: 'React 18 + webpack5',
    },
  },
};
