import { createI18n, type Messages } from "@bubblesjs/i18n-core";
import { reactive } from "vue";
import globalZhCN from "../locales/global/zh-CN.json";
import projectZhCN from "../locales/project/zh-CN.json";

type Scope = "global" | "project";
type PlaygroundLocale = "zh-CN" | "en-US";
export interface LocaleLoadRecord {
  scope: Scope;
  locale: PlaygroundLocale;
  status: "idle" | "loading" | "loaded" | "error";
  calls: number;
}

// 默认中文静态导入，初始化不调用 loader；这里仅观察后续切换的加载器调用。
export const localeLoads = reactive<LocaleLoadRecord[]>([
  { scope: "global", locale: "zh-CN", status: "loaded", calls: 0 },
  { scope: "global", locale: "en-US", status: "idle", calls: 0 },
  { scope: "project", locale: "zh-CN", status: "loaded", calls: 0 },
  { scope: "project", locale: "en-US", status: "idle", calls: 0 },
]);

function createLoader(scope: Scope) {
  return async (locale = "zh-CN"): Promise<Messages> => {
    if (locale !== "zh-CN" && locale !== "en-US") {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    const record = localeLoads.find((item) => item.scope === scope && item.locale === locale)!;
    record.calls += 1;
    record.status = "loading";

    try {
      // 只有切换语言时，才执行对应作用域的动态导入。
      const messages =
        scope === "global"
          ? (await import(`../locales/global/${locale}.json`)).default
          : (await import(`../locales/project/${locale}.json`)).default;
      record.status = "loaded";
      return messages;
    } catch (error) {
      record.status = "error";
      throw error;
    }
  };
}

export const globalStore = createI18n({
  locale: "zh-CN",
  message: globalZhCN,
  loaderMessage: createLoader("global"),
});

export const projectStore = createI18n({
  locale: "zh-CN",
  message: projectZhCN,
  loaderMessage: createLoader("project"),
});
