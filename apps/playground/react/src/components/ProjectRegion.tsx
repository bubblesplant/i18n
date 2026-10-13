import { I18nProvider } from "@bubblesjs/i18n-react";
import { projectStore } from "@/i18n";
import ProjectPanel from "./ProjectPanel";

export default function ProjectRegion() {
  // 局部写法：只有 ProjectPanel 及其后代读取 projectStore。
  return (
    <I18nProvider store={projectStore}>
      <ProjectPanel />
    </I18nProvider>
  );
}
