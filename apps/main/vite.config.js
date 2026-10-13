import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 主应用（容器）构建配置。
 *
 * 为什么主应用可以用 Vite，而子应用用 webpack？
 *   qiankun 通过 HTML Entry 加载子应用，需要子应用产出「经典脚本 + UMD」，
 *   这样它才能在沙箱里 eval 并把 bootstrap/mount/unmount 取出来。
 *   主应用是"宿主"，不参与这套加载协议，用什么都行 —— 选 Vite 图构建快、DX 好。
 *   详见 README「踩坑 01」。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 三个应用端口固定，方便运行时配置直接写死（本地开发）
    strictPort: true,
    host: true,
    // 子应用在 8081/8082，主应用需要能跨域请求它们的 dev server；
    // Vite 默认已开 CORS，这里显式声明避免歧义。
    cors: true,
  },
  build: {
    target: 'es2018',
    outDir: 'dist',
    assetsDir: 'assets',
    // 演示项目关掉 sourcemap，产物更干净、部署更快
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
