<!-- Adapted from antv-next-pro. Copyright (c) 2026 bubblesplant. MIT License. -->
<script setup lang="ts">
import { withBase } from "vitepress";
import PackageCommand from "./PackageCommand.vue";

const features = [
  {
    icon: "bolt",
    title: "实现思路：核心与框架分层",
    text: "核心容器管理语言、词条与订阅；React 和 Vue 将状态变化接入组件，让翻译随语言更新。",
    link: "/guide/architecture",
  },
  {
    icon: "code",
    title: "React：Provider + useI18n",
    text: "创建 store，用 I18nProvider 包住组件，再调用 useI18n() 获取 tr、locale 和 loadLocale。",
    link: "/guide/react",
  },
  {
    icon: "box",
    title: "Vue：Provider + useI18n",
    text: "创建 store，通过 I18nProvider 注入；在 setup 中调用 useI18n()，在模板中用 tr() 翻译。",
    link: "/guide/vue",
  },
  {
    icon: "tools",
    title: "CLI：扫描项目 → JSON",
    text: "sync 扫描静态 tr() 调用并同步 JSON；check 检查词条差异。同步时保留已有翻译，也可先预览。",
    link: "/guide/cli",
  },
  {
    icon: "palette",
    title: "语言切换：加载后更新组件",
    text: "用 loaderMessage 按需加载 JSON，通过 loadLocale 切换语言。加载完成后，订阅状态的组件自动刷新。",
    link: "/guide/core#异步初始化与切换",
  },
  {
    icon: "layers",
    title: "JSON ⇄ Excel：设计阶段",
    text: "计划把 JSON 导出为表格供翻译编辑，再导回语言包。当前 CLI 尚未实现 Excel 导入导出。",
    link: "/guide/cli",
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
        <h1 id="bubbles-title">一套词条，接入<br />Vue 与 React。</h1>
        <p class="bubbles-tagline">
          核心管理语言状态，组件订阅变化。<br />
          用 CLI 扫描项目，同步与检查 JSON 词条。
        </p>
        <div class="bubbles-actions">
          <a class="bubbles-button primary" :href="withBase('/guide/getting-started')">
            快速开始 <span aria-hidden="true">→</span>
          </a>
          <a class="bubbles-button secondary" :href="withBase('/guide/architecture')"
            >了解实现思路</a
          >
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

    <section class="bubbles-workflow" aria-labelledby="workflow-title">
      <h2 id="workflow-title">词条维护主线：扫描项目 → JSON ⇄ Excel</h2>
      <p>当前已支持扫描项目、同步与检查 JSON。JSON 与 Excel 往返编辑处于设计阶段，尚未提供命令。</p>
      <a :href="withBase('/guide/cli')">查看 CLI 命令与规划 <span aria-hidden="true">→</span></a>
    </section>

    <section class="bubbles-features" aria-label="实现思路、框架接入与词条维护">
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
      <h2>从创建容器到组件翻译。</h2>
      <a :href="withBase('/guide/getting-started')">
        查看安装与接入步骤 <span aria-hidden="true">→</span>
      </a>
      <a href="https://github.com/bubblesplant/i18n" target="_blank" rel="noopener noreferrer">
        GitHub 仓库 <span aria-hidden="true">↗</span>
      </a>
    </section>
  </div>
</template>
