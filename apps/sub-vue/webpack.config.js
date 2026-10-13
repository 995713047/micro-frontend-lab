const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

const APP_NAME = 'sub-vue';
const PORT = Number(process.env.PORT) || 8081;

/**
 * ⚠️ 必须写成函数形式，用 argv.mode 判断环境，而不是 process.env.NODE_ENV。
 *
 * 踩坑记录：webpack CLI 的 `--mode production` 只会设置 webpack 的 mode，
 * 【不会】设置 Node 进程的 process.env.NODE_ENV。如果配置里写
 *   const isDev = process.env.NODE_ENV !== 'production'
 * 那么 `webpack --mode production` 时 isDev 依然是 true，
 * 结果是"生产构建"带着 eval 形式的 sourcemap（产物 11MB 而不是 800KB），
 * 并且 publicPath 被写成 http://localhost:8081/ —— 上线必然白屏。
 */
module.exports = (env, argv = {}) => {
  const mode = argv.mode || process.env.NODE_ENV || 'development';
  const isDev = mode !== 'production';

  /**
   * 生产：子应用独立部署在 /sub-vue/ 路径下（单域名按路径方案）。
   * 开发：必须写死完整的 http://localhost:8081/。
   *
   * 这是最高频的踩坑点：主应用跑在 5173，子应用跑在 8081，
   * 子应用里的相对路径（./app.js）会被解析成 5173 域名下的地址，直接 404。
   */
  const publicPath = isDev ? `http://localhost:${PORT}/` : '/sub-vue/';

  return {
    mode,
    target: ['web', 'es2018'],

    entry: {
      main: path.resolve(__dirname, 'src/main.js'),
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].js' : 'js/[name].[contenthash:8].js',
      chunkFilename: isDev ? '[name].js' : 'js/[name].[contenthash:8].chunk.js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
      publicPath,

      // ---- qiankun 必需的三件套 ----
      // 1) UMD 产物：qiankun 从 window 上把 bootstrap/mount/unmount 取出来
      //    （library.name 与 appName 同名，正好命中 qiankun 的 fallback 查找逻辑）
      // 2) globalObject: window：避免被打成 self/global（沙箱里会取不到）
      // 3) 唯一的 chunkLoadingGlobal：两个子应用都是 webpack，
      //    默认都叫 webpackChunkwebpack，同时挂载会互相覆盖 chunk 注册表
      //    （典型症状：第二个子应用报 "Loading chunk xxx failed"）
      library: { name: APP_NAME, type: 'umd' },
      globalObject: 'window',
      chunkLoadingGlobal: `webpackChunk_${APP_NAME}`,
      uniqueName: APP_NAME,

      clean: true,
    },

    resolve: {
      extensions: ['.js', '.json', '.vue'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@mfe/shared': path.resolve(__dirname, '../../packages/shared/src/index.js'),
      },
    },

    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },

    plugins: [
      new VueLoaderPlugin(),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        filename: 'index.html',
        title: 'sub-vue · 子应用 A',
        inject: 'body',
        // qiankun 沙箱里 <script> 由 import-html-entry 处理，保留 script 标签即可
        scriptLoading: 'defer',
      }),
      // Vue 3 的编译期特性开关，不声明会有运行时警告
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(true),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
      }),
    ],

    optimization: {
      // 拆包会让 qiankun 需要额外请求 chunk，本地演示收益不大，
      // 保持单文件产物便于观察"子应用被整体加载/卸载"的行为
      splitChunks: false,
      runtimeChunk: false,
    },

    devtool: isDev ? 'eval-cheap-module-source-map' : false,

    devServer: {
      port: PORT,
      // ⚠️ 这里【不能】写 strictPort —— 那是 Vite 的选项。
      // webpack-dev-server v5 的 schema 里没有它，写了会直接启动失败：
      //   "Invalid options object. Dev Server has been initialized using an options
      //    object that does not match the API schema. - options has an unknown property 'strictPort'"
      //
      // 端口被占用时它会自动 +1。这里显式告警，避免"子应用跑在 8083，
      // 但主应用注册表还写着 8081"这种静默故障。
      onListening: (devServer) => {
        const actual = devServer.server?.address()?.port;
        if (actual && actual !== PORT) {
          console.warn(
            `[sub-vue] 端口 ${PORT} 被占用，实际监听 ${actual}；` +
              `请同步修改 apps/main/public/runtime-config.js 与 apps.json 里的 entry`,
          );
        }
      },
      hot: true,
      historyApiFallback: true,
      // 关键：主应用跨域请求本服务，必须放开 CORS
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      allowedHosts: 'all',
      client: {
        overlay: { errors: true, warnings: false },
      },
    },

    // element-plus 全量 CSS 本身就是 800KB+，这里刻意不屏蔽体积告警，
    // 真实项目应该用 unplugin-vue-components 做按需引入
    performance: { hints: false },

    stats: 'errors-warnings',
  };
};
