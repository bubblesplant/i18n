<script setup lang="ts">
import { useI18nStore } from "@bubblesjs/i18n-vue";
import GlobalPanel from "@/components/GlobalPanel.vue";
import LoaderRecords from "@/components/LoaderRecords.vue";
import { globalStore, projectStore } from "@/i18n";
import { initCode, vueGlobalCode, vueLocalCode } from "../../shared/snippets";

const globalLocale = useI18nStore(globalStore, (state) => state.locale);
const projectLocale = useI18nStore(projectStore, (state) => state.locale);
</script>

<template>
  <div class="playground-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="BubblesJS i18n Playground 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>BubblesJS <strong>i18n</strong></span>
      </a>
      <span class="header-label">VUE PLAYGROUND</span>
      <nav class="header-links" aria-label="资源链接">
        <a href="http://localhost:5175" target="_blank" rel="noreferrer">React 示例 ↗</a>
        <a href="http://localhost:5174/guide/vue" target="_blank" rel="noreferrer">使用文档 ↗</a>
      </nav>
    </header>
    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">Vue · 全局与局部</p>
        <h1 id="page-title">应用共享语言，<br class="mobile-break" />项目独立切换。</h1>
        <p class="intro-copy">
          入口挂载全局 Provider，项目区域提供局部 Provider。试着切换两处语言，观察文案与加载记录。
        </p>
      </section>
      <div class="demo-toolbar">
        <div class="framework-switch" role="group" aria-label="示例框架">
          <button type="button" aria-pressed="true">Vue</button>
          <a href="http://localhost:5175" target="_blank" rel="noreferrer">React ↗</a>
        </div>
        <span class="text-sm text-gray-500">Vue 3 · Antdv Next · UnoCSS · ESLint</span>
      </div>
      <div class="workbench">
        <section class="demo-panel" aria-labelledby="demo-title">
          <header class="panel-heading">
            <h2 id="demo-title"><span class="live-dot" aria-hidden="true"></span>运行示例</h2>
            <span>Vue adapter</span>
          </header>
          <div class="scope-state" aria-live="polite">
            <span
              ><i class="global-dot"></i>全局 <code>{{ globalLocale }}</code></span
            >
            <span
              ><i class="project-dot"></i>局部 <code>{{ projectLocale }}</code></span
            >
          </div>
          <div class="demo-body"><GlobalPanel /></div>
          <p class="demo-note">
            只切换项目语言，全局文案保持原语言。创建任务后切换语言，任务数量保留。
          </p>
        </section>
        <aside class="implementation" aria-label="Vue 全局与局部写法">
          <section class="code-section">
            <div class="step-heading">
              <span>01</span>
              <h2>创建两个独立容器</h2>
            </div>
            <p>默认中文静态导入；projectStore 用同样写法加载项目词条。</p>
            <pre><code>{{ initCode }}</code></pre>
          </section>
          <section class="code-section">
            <div class="step-heading">
              <span>02</span>
              <h2>全局写法 · 应用入口</h2>
            </div>
            <p>所有路由组件继承 globalStore，用 useI18n() 订阅语言和词条。</p>
            <pre><code>{{ vueGlobalCode }}</code></pre>
          </section>
          <section class="code-section">
            <div class="step-heading">
              <span>03</span>
              <h2>局部写法 · 项目子树</h2>
            </div>
            <p>后代读取最近的 Provider，项目词条与语言独立维护。</p>
            <pre><code>{{ vueLocalCode }}</code></pre>
          </section>
        </aside>
      </div>
      <LoaderRecords />
    </main>
    <footer class="site-footer">
      <span>BubblesJS i18n · Vue</span><span>全局共享 → 局部隔离 → 按需加载</span>
    </footer>
  </div>
</template>
