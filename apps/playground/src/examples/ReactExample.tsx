import { useState } from "react";
import { I18nProvider, useI18n } from "@bubblesjs/i18n-react";
import type { ExampleProps } from "./types";

interface LanguageSwitchProps {
  locale: string | undefined;
  label: "全局语言" | "项目语言";
  pending: boolean;
  onChange: (locale: string) => Promise<void>;
}

function LanguageSwitch({ locale, label, pending, onChange }: LanguageSwitchProps) {
  return (
    <div className="language-switch" role="group" aria-label={label} aria-busy={pending}>
      <button
        type="button"
        aria-pressed={locale === "zh-CN"}
        disabled={pending}
        onClick={() => void onChange("zh-CN")}
      >
        中文
      </button>
      <button
        type="button"
        aria-pressed={locale === "en-US"}
        disabled={pending}
        onClick={() => void onChange("en-US")}
      >
        English
      </button>
    </div>
  );
}

function ProjectPanel() {
  const { tr, locale, loadLocale } = useI18n();
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(0);

  async function changeLocale(nextLocale: string) {
    if (pending || nextLocale === locale) return;
    setPending(true);
    try {
      await loadLocale(nextLocale);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="project-scope" aria-label="局部项目示例">
      <header className="project-header">
        <div>
          <span className="scope-label">项目语言</span>
          <h4>{tr("项目工作区")}</h4>
        </div>
        <span className="locale-value">
          {tr("当前语言")}：{locale}
        </span>
      </header>
      <LanguageSwitch locale={locale} label="项目语言" pending={pending} onChange={changeLocale} />
      <div className="project-content">
        <p className="welcome-text">{tr("欢迎，{name}！", { name: "Alex" })}</p>
        <p className="muted-copy">{tr("这里的内容使用项目自己的语言。")}</p>
        <div className="task-row">
          <div>
            <strong>{tr("进行中的任务")}</strong>
            <span className="task-status">{tr("待审核")}</span>
          </div>
          <button
            className="task-button"
            type="button"
            onClick={() => setCount((value) => value + 1)}
          >
            {tr("创建任务")}
          </button>
        </div>
        <p className="action-message" aria-live="polite">
          {tr("已创建 {count} 个任务", { count })}
        </p>
      </div>
    </section>
  );
}

function GlobalPanel({ projectStore }: Pick<ExampleProps, "projectStore">) {
  const { tr, locale, loadLocale } = useI18n();
  const [pending, setPending] = useState(false);

  async function changeLocale(nextLocale: string) {
    if (pending || nextLocale === locale) return;
    setPending(true);
    try {
      await loadLocale(nextLocale);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="scope-demo" aria-label="全局应用示例">
      <header className="scope-heading">
        <div>
          <span className="scope-label">全局语言</span>
          <h3>{tr("应用概览")}</h3>
        </div>
        <span className="locale-value">
          {tr("当前语言")}：{locale}
        </span>
      </header>
      <LanguageSwitch locale={locale} label="全局语言" pending={pending} onChange={changeLocale} />
      <div className="preview-content">
        <p className="welcome-text">{tr("欢迎，{name}！", { name: "Bubbles" })}</p>
        <p className="muted-copy">{tr("这里的内容使用全局语言。")}</p>
        <div className="workspace-summary">
          <div className="summary-item">
            <span>{tr("工作空间")}</span>
            <strong>{tr("设计团队")}</strong>
          </div>
          <div className="summary-item">
            <span>{tr("当前语言")}</span>
            <strong>{locale}</strong>
          </div>
        </div>
      </div>
      <I18nProvider store={projectStore}>
        <ProjectPanel />
      </I18nProvider>
    </section>
  );
}

export function ReactExample({ globalStore, projectStore }: ExampleProps) {
  return (
    <I18nProvider store={globalStore}>
      <GlobalPanel projectStore={projectStore} />
    </I18nProvider>
  );
}
