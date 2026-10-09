<!-- Adapted from antv-next-pro. Copyright (c) 2026 bubblesplant. MIT License. -->
<script setup lang="ts">
import { withBase } from "vitepress";
import PackageCommand from "./PackageCommand.vue";

const features = [
  {
    icon: "bolt",
    title: "轻量核心，专注翻译",
    text: "扁平词条、占位符插值与状态订阅。用一个框架无关的容器，连接你的语言与界面。",
    link: "/guide/core",
  },
  {
    icon: "code",
    title: "React，熟悉的 Hooks",
    text: "通过 Provider 隔离组件子树的语言，用 Hooks 订阅状态，让翻译自然融入组件。",
    link: "/guide/react",
  },
  {
    icon: "box",
    title: "Vue，顺手的响应式",
    text: "Provider 与 Composables 连接同一套核心，在组件卸载时自动清理订阅。",
    link: "/guide/vue",
  },
  {
    icon: "tools",
    title: "词条 CLI，维护有序",
    text: "扫描静态翻译调用，补全 JSON 语言包并保留已有翻译。预览、检查与清理，都有据可循。",
    link: "/guide/cli",
  },
  {
    icon: "palette",
    title: "异步语言，从容切换",
    text: "按需加载词条，记住用户的语言偏好。切换期间保留当前内容，最后一次选择优先。",
    link: "/guide/core#异步初始化与切换",
  },
  {
    icon: "layers",
    title: "按需组合，自由接入",
    text: "核心、框架适配与 CLI 分别安装。提供 ESM、CommonJS 和 TypeScript 声明，支持服务端渲染。",
    link: "/guide/getting-started",
  },
];

const iconPaths: Record<string, string> = {
  bolt: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9 9-4M12 12 3 8m9 4v10M7.5 5.5l9 5",
  tools: "M4 7h16M4 17h16M8 4v6m8 4v6",
  palette:
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 .8-2.8H17a4 4 0 0 0 4-4C21 6 17 3 12 3ZM7 10h.01M10 6.5h.01M15 6.5h.01M18 10h.01",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
};
</script>

<template>
  <div class="bubbles-home vp-raw">
    <section class="bubbles-hero" aria-labelledby="bubbles-title">
      <div class="bubbles-copy">
        <p class="bubbles-wordmark">BubblesJS i18n</p>
        <h1 id="bubbles-title">让多语言体验<br />轻盈一点。</h1>
        <p class="bubbles-tagline">
          一套词条，从语言加载到组件翻译。<br />
          为 React、Vue 与你的下一段体验准备。
        </p>
        <div class="bubbles-actions">
          <a class="bubbles-button primary" :href="withBase('/guide/getting-started')">
            快速开始 <span aria-hidden="true">→</span>
          </a>
          <a class="bubbles-button secondary" :href="withBase('/guide/cli')">探索词条 CLI</a>
        </div>
        <PackageCommand />
      </div>

      <div
        class="bubbles-visual"
        role="img"
        aria-label="漂浮在彩色泡泡间的国际化代码预览：用 createI18n 创建词条容器，将 welcome 翻译为你好，Bubbles"
      >
        <div class="bubble-orbit orbit-back"></div>
        <div class="bubble bubble-top"></div>
        <div class="bubble bubble-tiny"></div>
        <div class="bubble-window">
          <div class="bubble-window-bar">
            <span class="window-brand">
              <img :src="withBase('/mark.svg')" alt="" /> BubblesJS i18n
            </span>
            <span class="window-dots"><i></i><i></i><i></i></span>
          </div>
          <div class="bubble-window-body">
            <div class="window-sidebar">
              <span class="sidebar-active"></span><span></span><span></span><span></span
              ><span></span>
            </div>
            <div class="window-content">
              <div class="preview-title">
                <span>#</span> 你好，Bubbles<span class="hello-dot">.</span>
              </div>
              <div class="preview-placeholder"></div>
              <div class="preview-placeholder short"></div>
              <div class="preview-code">
                <div class="preview-filename">
                  <span class="syntax-blue">TS</span> i18n.ts <span>●</span>
                </div>
                <div class="preview-code-lines">
                  <div>
                    <span class="syntax-purple">const</span> store =
                    <span class="syntax-blue">createI18n</span>({
                  </div>
                  <div>&nbsp;&nbsp;locale: <span class="syntax-green">'zh-CN'</span>,</div>
                  <div>
                    &nbsp;&nbsp;message: { welcome:
                    <span class="syntax-green">'你好，{name}！'</span> }
                  </div>
                  <div>})</div>
                  <div class="code-space"></div>
                  <div>
                    <span class="syntax-purple">const</span> { tr } = store.<span
                      class="syntax-blue"
                      >getState</span
                    >()
                  </div>
                  <div>
                    <span class="syntax-blue">tr</span>(<span class="syntax-green">'welcome'</span>,
                    { name: <span class="syntax-green">'Bubbles'</span> })
                  </div>
                </div>
              </div>
              <div class="preview-status"><span></span>同一套词条，连接你的界面</div>
            </div>
          </div>
        </div>
        <div class="bubble bubble-main">
          <span class="bubble-face"><i></i><i></i><b></b></span>
        </div>
        <div class="bubble bubble-small"></div>
        <div class="bubble bubble-bottom"></div>
        <span class="bubble-sparkle sparkle-one">✧</span>
        <span class="bubble-sparkle sparkle-two">✧</span>
      </div>
    </section>

    <section class="bubbles-features" aria-label="为你的下一段多语言体验准备">
      <a
        v-for="feature in features"
        :key="feature.icon"
        :href="withBase(feature.link)"
        class="bubbles-feature"
      >
        <div class="feature-icon" :class="`icon-${feature.icon}`">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="iconPaths[feature.icon]" />
          </svg>
        </div>
        <h2>{{ feature.title }}</h2>
        <p>{{ feature.text }}</p>
        <span class="feature-arrow" aria-hidden="true">↗</span>
      </a>
    </section>

    <section class="bubbles-start">
      <img :src="withBase('/mark.svg')" alt="" width="32" height="32" />
      <h2>让下一段体验，从容一点。</h2>
      <a :href="withBase('/guide/getting-started')">
        认识 BubblesJS i18n <span aria-hidden="true">→</span>
      </a>
    </section>
  </div>
</template>
