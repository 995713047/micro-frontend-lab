const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const APP_NAME = 'sub-react';
const PORT = Number(process.env.PORT) || 8082;

/**
 * ⚠️ 同 sub-vue：必须用 argv.mode 判断环境，不能用 process.env.NODE_ENV。
 * 详见 apps/sub-vue/webpack.config.js 顶部注释。
 */
module.exports = (env, argv = {}) => {
  const mode = argv.mode || process.env.NODE_ENV || 'development';
  const isDev = mode !== 'production';

  /** dev 用绝对 URL，生产用独立路径前缀 */
  const publicPath = isDev ? `http://localhost:${PORT}/` : '/sub-react/';

  return {
    mode,
    target: ['web', 'es2018'],

    entry: {
      main: path.resolve(__dirname, 'src/main.jsx'),
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].js' : 'js/[name].[contenthash:8].js',
      chunkFilename: isDev ? '[name].js' : 'js/[name].[contenthash:8].chunk.js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
      publicPath,

      // qiankun 三件套，见 sub-vue/webpack.config.js 的注释
      library: { name: APP_NAME, type: 'umd' },
      globalObject: 'window',
      // 两个 webpack 子应用同时挂载时，chunkLoadingGlobal 必须互不相同
      chunkLoadingGlobal: `webpackChunk_${APP_NAME}`,
      uniqueName: APP_NAME,

      clean: true,
    },

    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@mfe/shared': path.resolve(__dirname, '../../packages/shared/src/index.js'),
      },
    },

    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                ['@babel/preset-env', { targets: { chrome: '80' } }],
                // automatic runtime：不用每个文件手写 import React
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
          type: 'asset/resource',
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        filename: 'index.html',
        title: 'sub-react · 子应用 B',
        inject: 'body',
        scriptLoading: 'defer',
      }),
      // ⚠️ 这里【不要】再 DefinePlugin 定义 process.env.NODE_ENV：
      // webpack 的 mode=production 已经内置了这个定义，
      // 重复定义会触发 "Conflicting values for 'process.env.NODE_ENV'" 警告，
      // 而且会导致 react.development.js 被打进产物（体积直接翻三倍）。
    ],

    optimization: {
      splitChunks: false,
      runtimeChunk: false,
    },

    devtool: isDev ? 'eval-cheap-module-source-map' : false,

    devServer: {
      port: PORT,
      // webpack-dev-server v5 没有 strictPort（Vite 才有）。
      // 端口被占用时它会自动 +1，所以这里显式告警，
      // 避免出现"子应用跑在 8083，但主应用注册表还写着 8081"这种静默故障。
      onListening: (devServer) => {
        const actual = devServer.server?.address()?.port;
        if (actual && actual !== PORT) {
          console.warn(
            `[sub-react] 端口 ${PORT} 被占用，实际监听 ${actual}；` +
              `请同步修改 apps/main/public/runtime-config.js 与 apps.json 里的 entry`,
          );
        }
      },
      hot: true,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      allowedHosts: 'all',
      client: {
        overlay: { errors: true, warnings: false },
      },
    },

    performance: { hints: false },

    stats: 'errors-warnings',
  };
};
