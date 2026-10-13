#!/bin/sh
# =============================================================================
# 容器启动时生成 /runtime-config.js 与 /apps.json。
#
# 这就是「构建一次，多环境部署」的落地点：
#   子应用地址是"环境相关"的信息，如果它被打进 bundle，
#   那 dev / staging / prod 就得构建三次，产物无法复用、无法直接用同一镜像回滚。
#   把它外置成运行时配置后，同一个镜像 + 不同环境变量 = 不同环境。
#
# 由 nginx 官方镜像的 /docker-entrypoint.d/ 机制自动执行。
# =============================================================================
set -eu

: "${MFE_ENV:=production}"
: "${MFE_APP_TITLE:=微前端实验室}"
: "${MFE_ISOLATION:=strict}"
: "${MFE_REGISTRY_URL:=/apps.json}"
: "${SUB_VUE_ENTRY:=/sub-vue/}"
: "${SUB_REACT_ENTRY:=/sub-react/}"

WEB_ROOT="${WEB_ROOT:-/usr/share/nginx/html}"

cat > "${WEB_ROOT}/runtime-config.js" <<EOF
/* 由 deploy/entrypoint.sh 在容器启动时生成，请勿手动修改 */
window.__MFE_CONFIG__ = {
  env: "${MFE_ENV}",
  appTitle: "${MFE_APP_TITLE}",
  registryUrl: "${MFE_REGISTRY_URL}",
  defaultIsolation: "${MFE_ISOLATION}",
  apps: {
    "sub-vue": {
      name: "sub-vue",
      title: "子应用 A · Vue3",
      entry: "${SUB_VUE_ENTRY}",
      route: "/sub-vue",
      color: "#41b883",
      stack: "Vue 3 + webpack5 + element-plus"
    },
    "sub-react": {
      name: "sub-react",
      title: "子应用 B · React18",
      entry: "${SUB_REACT_ENTRY}",
      route: "/sub-react",
      color: "#61dafb",
      stack: "React 18 + webpack5"
    }
  }
};
EOF

cat > "${WEB_ROOT}/apps.json" <<EOF
{
  "version": "1.0.0",
  "generatedBy": "deploy/entrypoint.sh",
  "env": "${MFE_ENV}",
  "apps": [
    {
      "name": "sub-vue",
      "title": "子应用 A · Vue3",
      "entry": "${SUB_VUE_ENTRY}",
      "route": "/sub-vue",
      "activeRule": "/sub-vue",
      "color": "#41b883",
      "stack": "Vue 3 + webpack5 + element-plus"
    },
    {
      "name": "sub-react",
      "title": "子应用 B · React18",
      "entry": "${SUB_REACT_ENTRY}",
      "route": "/sub-react",
      "activeRule": "/sub-react",
      "color": "#61dafb",
      "stack": "React 18 + webpack5"
    }
  ]
}
EOF

echo "[entrypoint] runtime-config.js 已生成 (env=${MFE_ENV}, sub-vue=${SUB_VUE_ENTRY}, sub-react=${SUB_REACT_ENTRY})"
