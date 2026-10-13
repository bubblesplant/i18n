import { createI18n } from "@bubblesjs/i18n-core";
import { createLoadMonitor } from "../shared/load-monitor";
import globalZhCN from "../locales/global/zh-CN.json";
import projectZhCN from "../locales/project/zh-CN.json";

export const { records: localeLoads, observe } = createLoadMonitor();

// 全局容器只创建一次；默认中文同步就绪，切换时才调用加载器。
export const globalStore = createI18n({
  locale: "zh-CN",
  message: globalZhCN,
  loaderMessage: observe("global", async (locale = "zh-CN") =>
    locale === "zh-CN" ? globalZhCN : (await import("../locales/global/en-US.json")).default,
  ),
});

// 局部区域使用另一份容器和词条，语言独立于应用全局。
export const projectStore = createI18n({
  locale: "zh-CN",
  message: projectZhCN,
  loaderMessage: observe("project", async (locale = "zh-CN") =>
    locale === "zh-CN" ? projectZhCN : (await import("../locales/project/en-US.json")).default,
  ),
});
