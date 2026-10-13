# syntax=docker/dockerfile:1
# =============================================================================
# 一个 Dockerfile 构建三个应用，用 APP 参数区分。
#
# 为什么是"一个镜像一个应用"而不是"三个应用打进一个镜像"：
#   打进一个镜像就回到了"改一个子应用要重新发布整个站点"的老路，
#   微前端的独立部署价值就没了。分开构建才能真正做到
#   "子应用 A 发版不影响子应用 B，也不需要主应用跟着发版"。
#
# 用法：
#   docker build -f deploy/Dockerfile --build-arg APP=main      -t mfe-main      .
#   docker build -f deploy/Dockerfile --build-arg APP=sub-vue   -t mfe-sub-vue   .
#   docker build -f deploy/Dockerfile --build-arg APP=sub-react -t mfe-sub-react .
# =============================================================================

# ---------------------------------------------------------------- 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

ARG APP=main
ENV npm_config_cache=/tmp/npm-cache

# 先只拷贝 package 清单：只要依赖没变，改业务代码不会触发重新安装依赖，
# 这一层能被 Docker 缓存住，构建时间从几分钟降到几秒
COPY package.json package-lock.json ./
COPY packages/shared/package.json  ./packages/shared/package.json
COPY apps/main/package.json        ./apps/main/package.json
COPY apps/sub-vue/package.json     ./apps/sub-vue/package.json
COPY apps/sub-react/package.json   ./apps/sub-react/package.json

RUN npm ci

COPY packages ./packages
COPY apps     ./apps
COPY scripts  ./scripts
COPY deploy   ./deploy

RUN npm run build --workspace @mfe/${APP} \
 && test -f apps/${APP}/dist/index.html

# ---------------------------------------------------------------- 运行阶段
FROM nginx:1.27-alpine AS runner

ARG APP=main

LABEL org.opencontainers.image.title="micro-frontend-lab-${APP}" \
      org.opencontainers.image.description="微前端实验室 · ${APP}" \
      org.opencontainers.image.source="https://github.com/995713047/micro-frontend-lab"

COPY --from=builder /app/apps/${APP}/dist /usr/share/nginx/html
COPY deploy/nginx.conf  /etc/nginx/conf.d/default.conf

# nginx 官方镜像会按文件名顺序执行 /docker-entrypoint.d/ 下的脚本，
# 把运行时配置生成放到 40- 前缀，晚于官方脚本、早于 nginx 启动
COPY deploy/entrypoint.sh /docker-entrypoint.d/40-mfe-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-mfe-runtime-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
