<script setup lang="ts">
import type { ExampleProps } from "./examples/types";
import { computed, onScopeDispose, ref } from "vue";
import ReactExample from "./examples/ReactExample.vue";
import VueExample from "./examples/VueExample.vue";
import { localeLoads } from "./i18n";

const props = defineProps<ExampleProps>();
const framework = ref<"React" | "Vue">("React");
const globalLocale = ref(props.globalStore.getState().locale);
const projectLocale = ref(props.projectStore.getState().locale);

const unsubscribeGlobal = props.globalStore.subscribe(() => {
  globalLocale.value = props.globalStore.getState().locale;
});
const unsubscribeProject = props.projectStore.subscribe(() => {
  projectLocale.value = props.projectStore.getState().locale;
});
onScopeDispose(() => {
  unsubscribeGlobal();
  unsubscribeProject();
});

const loadedCount = computed(
  () => localeLoads.filter((record) => record.status === "loaded").length,
);
const statusLabels = { idle: "尚未加载", loading: "加载中", loaded: "已加载", error: "加载失败" };
const initCode = [
  'import { createI18n } from "@bubblesjs/i18n-core";',
  'import zhCN from "./locales/zh-CN.json";',
  "",
  "const store = createI18n({",
  '  locale: "zh-CN",',
  "  message: zhCN,",
  '  loaderMessage: async (locale = "zh-CN") =>',
  `    (await import(\`./locales/\${locale}.json\`)).default,`,
  "});",
].join("\n");
const providerCode = computed(() =>
  framework.value === "React"
    ? `<I18nProvider store={globalStore}>
  <GlobalContent />
  <I18nProvider store={projectStore}>
    <ProjectContent />
  </I18nProvider>
</I18nProvider>`
    : `<I18nProvider :store="globalStore">
  <GlobalContent />
  <I18nProvider :store="projectStore">
    <ProjectContent />
  </I18nProvider>
</I18nProvider>`,
);
</script>

<template>
  <div class="playground-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="BubblesJS i18n Playground 首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>BubblesJS <strong>i18n</strong></span>
      </a>
      <span class="header-label">PLAYGROUND</span>
      <nav class="header-links" aria-label="资源链接">
        <a href="http://localhost:5174/guide/getting-started" target="_blank" rel="noreferrer"
          >使用文档 ↗</a
        >
        <a href="https://github.com/bubblesplant/i18n" target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>
    </header>

    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">一个加载器，两种作用域</p>
        <h1 id="page-title">语言按需加载，<br class="mobile-break" />项目独立切换。</h1>
        <p class="intro-copy">
          导入默认语言，显式配置 locale、message 和加载器，Provider
          提供容器，切换时再加载目标语言包。
        </p>
      </section>

      <div class="demo-toolbar">
        <div class="framework-switch" role="group" aria-label="示例框架">
          <button type="button" :aria-pressed="framework === 'React'" @click="framework = 'React'">
            React
          </button>
          <button type="button" :aria-pressed="framework === 'Vue'" @click="framework = 'Vue'">
            Vue
          </button>
        </div>
        <p>同一组容器 · 切换框架保留语言状态</p>
      </div>

      <div class="workbench">
        <section class="demo-panel" aria-labelledby="demo-title">
          <header class="panel-heading">
            <h2 id="demo-title"><span class="live-dot" aria-hidden="true"></span>运行示例</h2>
            <span>{{ framework }} adapter</span>
          </header>
          <div class="scope-state" aria-live="polite">
            <span
              ><i class="global-dot"></i>全局 <code>{{ globalLocale }}</code></span
            >
            <span
              ><i class="project-dot"></i>局部 <code>{{ projectLocale }}</code></span
            >
          </div>
          <div class="demo-body">
            <ReactExample
              v-if="framework === 'React'"
              :global-store="globalStore"
              :project-store="projectStore"
            />
            <VueExample v-else :global-store="globalStore" :project-store="projectStore" />
          </div>
          <p class="demo-note">
            试试只切换项目语言，再创建一个任务。外层语言不受影响，任务状态也会保留。
          </p>
        </section>

        <aside class="implementation" aria-label="接入思路">
          <section class="code-section">
            <div class="step-heading">
              <span>01</span>
              <h2>默认语言先加载</h2>
            </div>
            <p>只静态导入中文，<code>createI18n</code> 同步创建容器；英文在切换时动态加载。</p>
            <pre><code>{{ initCode }}</code></pre>
          </section>
          <section class="code-section">
            <div class="step-heading">
              <span>02</span>
              <h2>局部使用独立容器</h2>
            </div>
            <p>
              给项目创建自己的 store，在子树内嵌套 Provider。后代的
              <code>useI18n()</code> 读取最近的容器。
            </p>
            <pre><code>{{ providerCode }}</code></pre>
          </section>
          <section class="switch-explanation">
            <div class="step-heading">
              <span>03</span>
              <h2>切换再调用加载器</h2>
            </div>
            <code>await loadLocale("en-US")</code>
            <p>加载目标 JSON → 提交语言与词条 → 订阅组件更新。</p>
          </section>
        </aside>
      </div>

      <section class="load-panel" aria-labelledby="load-title">
        <header class="load-heading">
          <div>
            <p class="eyebrow">LOADER MESSAGE</p>
            <h2 id="load-title">语言包加载记录</h2>
          </div>
          <span class="load-count"
            ><strong>{{ loadedCount }}</strong> / 4 个语言包已加载</span
          >
        </header>
        <p class="load-description">
          默认中文已静态导入，首屏加载器调用均为 0。点击对应区域的 English，观察英文包首次加载。
        </p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">作用域</th>
                <th scope="col">语言包</th>
                <th scope="col">状态</th>
                <th scope="col">加载器调用</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in localeLoads"
                :key="`${record.scope}-${record.locale}`"
                :data-scope="record.scope"
                :data-locale="record.locale"
              >
                <td>
                  <span class="table-scope" :class="record.scope">{{
                    record.scope === "global" ? "全局应用" : "局部项目"
                  }}</span>
                </td>
                <td>
                  <code>{{ record.scope }}/{{ record.locale }}.json</code>
                </td>
                <td>
                  <span class="load-status" :class="record.status">{{
                    statusLabels[record.status]
                  }}</span>
                </td>
                <td>{{ record.calls }} 次</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="load-footnote">
          默认中文的静态导入不计为加载器调用；切换时记录 loaderMessage 的调用次数。动态 import
          可复用浏览器的模块缓存。
        </p>
      </section>
    </main>

    <footer class="site-footer">
      <span>BubblesJS i18n · core / react / vue</span><span>默认加载 → 按需切换 → 局部隔离</span>
    </footer>
  </div>
</template>
