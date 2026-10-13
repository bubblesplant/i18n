import { useI18n } from "@bubblesjs/i18n-react";
import { useState } from "react";
import LanguageSwitch from "./LanguageSwitch";
import ProjectRegion from "./ProjectRegion";

export default function GlobalPanel() {
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
          <p className="scope-label">全局应用</p>
          <h2>{tr("应用概览")}</h2>
        </div>
        <LanguageSwitch
          locale={locale}
          label="全局语言"
          pending={pending}
          onChange={changeLocale}
        />
      </header>
      <div className="preview-content">
        <p className="welcome-text">{tr("欢迎，{name}！", { name: "Bubbles" })}</p>
        <p className="muted-copy">{tr("这里的内容使用全局语言。")}</p>
        <dl className="workspace-summary">
          <div className="summary-item">
            <dt>{tr("工作空间")}</dt>
            <dd>{tr("设计团队")}</dd>
          </div>
          <div className="summary-item">
            <dt>{tr("当前语言")}</dt>
            <dd className="locale-value">{locale}</dd>
          </div>
        </dl>
      </div>
      <ProjectRegion />
    </section>
  );
}
