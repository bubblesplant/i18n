import { useI18nStore } from "@bubblesjs/i18n-react";
import GlobalPanel from "@/components/GlobalPanel";
import LoaderRecords from "@/components/LoaderRecords";
import { globalStore, projectStore } from "@/i18n";
import { initCode, reactGlobalCode, reactLocalCode } from "../../shared/snippets";

const codeSections = [
  {
    title: "创建两个独立容器",
    description: "默认中文静态导入；projectStore 用同样写法加载项目词条。",
    code: initCode,
  },
  {
    title: "全局写法 · 应用入口",
    description: "所有路由组件继承 globalStore，用 useI18n() 订阅语言和词条。",
    code: reactGlobalCode,
  },
  {
    title: "局部写法 · 项目子树",
    description: "后代读取最近的 Provider，项目词条与语言独立维护。",
    code: reactLocalCode,
  },
];

export default function Home() {
  const globalLocale = useI18nStore(globalStore, (state) => state.locale);
  const projectLocale = useI18nStore(projectStore, (state) => state.locale);
  return (
    <div className="playground-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="BubblesJS i18n Playground 首页">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            BubblesJS <strong>i18n</strong>
          </span>
        </a>
        <span className="header-label">REACT PLAYGROUND</span>
        <nav className="header-links" aria-label="资源链接">
          <a href="http://localhost:5173" target="_blank" rel="noreferrer">
            Vue 示例 ↗
          </a>
          <a href="http://localhost:5174/guide/react" target="_blank" rel="noreferrer">
            使用文档 ↗
          </a>
        </nav>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">React · 全局与局部</p>
          <h1 id="page-title">
            应用共享语言，
            <br className="mobile-break" />
            项目独立切换。
          </h1>
          <p className="intro-copy">
            入口挂载全局 Provider，项目区域提供局部 Provider。试着切换两处语言，观察文案与加载记录。
          </p>
        </section>
        <div className="demo-toolbar">
          <div className="framework-switch" role="group" aria-label="示例框架">
            <a href="http://localhost:5173" target="_blank" rel="noreferrer">
              Vue ↗
            </a>
            <button type="button" aria-pressed="true">
              React
            </button>
          </div>
          <span className="text-sm text-gray-500">
            React · Ant Design · Tailwind · React Router
          </span>
        </div>
        <div className="workbench">
          <section className="demo-panel" aria-labelledby="demo-title">
            <header className="panel-heading">
              <h2 id="demo-title">
                <span className="live-dot" aria-hidden="true" />
                运行示例
              </h2>
              <span>React adapter</span>
            </header>
            <div className="scope-state" aria-live="polite">
              <span>
                <i className="global-dot" />
                全局 <code>{globalLocale}</code>
              </span>
              <span>
                <i className="project-dot" />
                局部 <code>{projectLocale}</code>
              </span>
            </div>
            <div className="demo-body">
              <GlobalPanel />
            </div>
            <p className="demo-note">
              只切换项目语言，全局文案保持原语言。创建任务后切换语言，任务数量保留。
            </p>
          </section>
          <aside className="implementation" aria-label="React 全局与局部写法">
            {codeSections.map((section, index) => (
              <section className="code-section" key={section.title}>
                <div className="step-heading">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h2>{section.title}</h2>
                </div>
                <p>{section.description}</p>
                <pre>
                  <code>{section.code}</code>
                </pre>
              </section>
            ))}
          </aside>
        </div>
        <LoaderRecords />
      </main>
      <footer className="site-footer">
        <span>BubblesJS i18n · React</span>
        <span>全局共享 → 局部隔离 → 按需加载</span>
      </footer>
    </div>
  );
}
