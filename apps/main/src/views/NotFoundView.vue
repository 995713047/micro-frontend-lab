<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <h1 class="page-title">404</h1>
  <p class="page-subtitle">
    这个路径没有匹配到任何路由。注意子应用的路径必须以主应用注册的
    <span class="code-inline">activeRule</span> 开头，否则会被主应用的通配路由吃掉。
  </p>
  <RouterLink class="btn btn--primary" to="/">返回总览</RouterLink>
</template>
