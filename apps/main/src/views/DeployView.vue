<script setup>
/**
 * 部署方案说明页。
 * 页面里展示的配置与仓库 deploy/ 目录下的真实文件保持一致。
 */
const topologies = [
  {
    key: 'path',
    name: '单域名按路径',
    example: 'https://mfe.example.com/ 、/sub-vue/ 、/sub-react/',
    pros: ['一份证书、一处 nginx', '天然同源，不存在 CORS', '主应用无需配置子应用完整 URL'],
    cons: ['子应用不能占用根路径', 'nginx 路由规则会随应用增多变复杂'],
    scene: '中小团队、子应用由同一团队维护',
  },
  {
    key: 'domain',
    name: '多域名独立部署',
    example: 'https://main.example.com 、https://vue.example.com',
    pros: ['子应用完全自治，可独立发版/回滚', '物理隔离，故障不互相影响', '可分别走不同 CDN'],
    cons: ['必须处理 CORS', 'Cookie/鉴权需要跨域方案', '主应用要维护子应用地址清单'],
    scene: '多团队协作、子应用技术栈差异大',
  },
  {
    key: 'cdn',
    name: '主应用 + 对象存储/CDN',
    example: '主应用在 nginx，子应用静态产物丢 CDN',
    pros: ['子应用产物不经过应用服务器', '发布 = 上传文件 + 改注册表', '成本低、扩容无压力'],
    cons: ['CDN 缓存需要版本化（contenthash）', '回滚依赖历史版本文件保留'],
    scene: '已经上云、追求发布效率',
  },
];

const nginxPathConfig = `# 单域名按路径部署：三个应用一份 nginx 配置
server {
    listen       80;
    server_name  mfe.example.com;
    root         /usr/share/nginx/html;

    # gzip 对 JS 收益最大，子应用产物一般几百 KB
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # 主应用：history 路由必须回退到 index.html，
    # 否则刷新 /lab/isolation 会 404（README 踩坑 08）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 子应用 A —— 注意 alias 结尾的斜杠必须与 location 一致，
    # 少一个斜杠就会变成 /usr/share/nginx/html/sub-vue/sub-vue/xxx
    location /sub-vue/ {
        alias /usr/share/nginx/html/sub-vue/;
        try_files $uri $uri/ /sub-vue/index.html;
    }

    # 子应用 B
    location /sub-react/ {
        alias /usr/share/nginx/html/sub-react/;
        try_files $uri $uri/ /sub-react/index.html;
    }

    # 带 contenthash 的静态资源可以长期缓存
    location ~* \\.(?:js|css|woff2?|png|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html 绝对不能缓存，否则子应用发版后用户仍加载旧注册表
    location ~* /index\\.html$ {
        add_header Cache-Control "no-store";
    }
}`;

const nginxDomainConfig = `# 多域名部署：子应用所在域名必须放开 CORS，
# 因为 qiankun 是用 fetch 去拉子应用的 HTML，再 eval 里面的脚本
server {
    listen       80;
    server_name  vue.example.com;
    root         /usr/share/nginx/html;

    # 关键：只允许主应用域名来取微应用资源
    add_header Access-Control-Allow-Origin  "https://main.example.com" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;
    # 如果主应用 fetch 时带了 Cookie，需要下面这行 + 上面不能用 *
    # add_header Access-Control-Allow-Credentials "true" always;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`;

const runtimeConfigSnippet = `// entrypoint.sh 在容器启动时生成 /runtime-config.js
// 关键点：它是普通静态文件，不在 bundle 里，所以换环境不用重新构建
window.__MFE_CONFIG__ = {
  env: "\${MFE_ENV}",
  appTitle: "\${MFE_APP_TITLE}",
  registryUrl: "\${MFE_REGISTRY_URL}",
  defaultIsolation: "\${MFE_ISOLATION}",
  apps: {
    "sub-vue":   { entry: "\${SUB_VUE_ENTRY}" },
    "sub-react": { entry: "\${SUB_REACT_ENTRY}" }
  }
};`;

const dockerSnippet = `# deploy/docker-compose.yml（节选）
services:
  gateway:            # 只做反向代理，把三个应用拼成一个域名
    image: nginx:1.27-alpine
    ports: ["8080:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [main]

  main:               # 主应用静态产物
    build:
      context: ..
      dockerfile: deploy/Dockerfile
      args: { APP: main }
    environment:
      MFE_ENV: production
      SUB_VUE_ENTRY: /sub-vue/
      SUB_REACT_ENTRY: /sub-react/
      MFE_REGISTRY_URL: /apps.json`;

const pitfalls = [
  '子应用跨域：dev 阶段主应用 5173 去拉 8081 的 HTML，子应用必须返回 Access-Control-Allow-Origin',
  'publicPath：dev 必须写完整 http://localhost:8081/，生产写 /sub-vue/，写错的症状是 JS/CSS 全 404',
  'index.html 不能被缓存：否则子应用发版了，主应用拿到的还是旧注册表/旧资源',
  'history 路由要 try_files 回退，hash 路由则不需要',
  '资源域名和接口域名不一致时会触发跨域，子应用需要独立配置反向代理',
];

const active = ref('path');
</script>

<template>
  <h1 class="page-title">部署方案</h1>
  <p class="page-subtitle">
    微前端的部署难点不在"怎么发"，而在"三个应用如何拼成一个对用户透明的站点"。
    下面是三种拓扑、真实可用的 nginx 配置，以及本项目跑通的运行时配置注入方案。
  </p>

  <div class="card">
    <h2 class="card__title">三种部署拓扑</h2>
    <div class="grid-3">
      <div
        v-for="item in topologies"
        :key="item.key"
        class="arch__box"
        :class="{ 'arch__box--main': active === item.key }"
        style="cursor: pointer"
        @click="active = item.key"
      >
        <div class="arch__box-title">{{ item.name }}</div>
        <div class="arch__box-meta">{{ item.example }}</div>
        <div class="tiny" style="margin-top: 8px">
          <div style="color: var(--mfe-success)">✔ {{ item.pros.join(' / ') }}</div>
          <div style="color: var(--mfe-warning); margin-top: 4px">
            ✘ {{ item.cons.join(' / ') }}
          </div>
          <div class="muted" style="margin-top: 4px">适用：{{ item.scene }}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">nginx 配置 · 单域名按路径</h2>
    <p class="card__desc">
      本项目 <span class="code-inline">npm run serve</span> 就是用 Node 模拟了这套规则，
      可以本地验证生产行为。
    </p>
    <pre class="code-block">{{ nginxPathConfig }}</pre>
  </div>

  <div class="card">
    <h2 class="card__title">nginx 配置 · 多域名独立部署</h2>
    <p class="card__desc">
      重点在 CORS：qiankun 加载子应用的第一步是 fetch 子应用的 HTML，这一步就是跨域请求。
    </p>
    <pre class="code-block">{{ nginxDomainConfig }}</pre>
  </div>

  <div class="grid-2">
    <div class="card">
      <h2 class="card__title">运行时配置注入（一次构建，多环境部署）</h2>
      <p class="card__desc">
        子应用地址不进 bundle，而是放在 <span class="code-inline">/runtime-config.js</span>。
        镜像不变，只改环境变量就能切环境。
      </p>
      <pre class="code-block">{{ runtimeConfigSnippet }}</pre>
    </div>

    <div class="card">
      <h2 class="card__title">Docker Compose 编排</h2>
      <p class="card__desc">
        每个应用一个镜像，网关只做反向代理。子应用可以独立发布、独立回滚。
      </p>
      <pre class="code-block">{{ dockerSnippet }}</pre>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">部署相关的高频坑</h2>
    <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.9">
      <li v-for="item in pitfalls" :key="item">{{ item }}</li>
    </ul>
    <p class="tiny muted" style="margin: 12px 0 0">
      完整版（含现象、原因、解决方案）见仓库 README 的「踩坑清单」章节。
    </p>
  </div>
</template>
