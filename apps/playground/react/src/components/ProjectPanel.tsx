import { useI18n } from "@bubblesjs/i18n-react";
import { Button } from "antd";
import { useState } from "react";
import LanguageSwitch from "./LanguageSwitch";

export default function ProjectPanel() {
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
          <p className="scope-label">局部项目</p>
          <h3>{tr("项目工作区")}</h3>
        </div>
        <LanguageSwitch
          locale={locale}
          label="项目语言"
          pending={pending}
          onChange={changeLocale}
        />
      </header>
      <div className="project-content">
        <p className="welcome-text">{tr("欢迎，{name}！", { name: "Alex" })}</p>
        <p className="muted-copy">{tr("这里的内容使用项目自己的语言。")}</p>
        <p className="muted-copy">
          {tr("当前语言")}：<span className="locale-value">{locale}</span>
        </p>
        <div className="task-row">
          <span>{tr("进行中的任务")}</span>
          <span className="task-status">{tr("待审核")}</span>
        </div>
        <Button
          className="task-button"
          type="primary"
          onClick={() => setCount((value) => value + 1)}
        >
          {tr("创建任务")}
        </Button>
        <p className="action-message" aria-live="polite">
          {tr("已创建 {count} 个任务", { count })}
        </p>
      </div>
    </section>
  );
}
