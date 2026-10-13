import { createStore, type LoadMessages } from "@bubblesjs/i18n-core";

export type Scope = "global" | "project";
export type PlaygroundLocale = "zh-CN" | "en-US";
export interface LocaleLoadRecord {
  scope: Scope;
  locale: PlaygroundLocale;
  status: "idle" | "loading" | "loaded" | "error";
  calls: number;
}
export const statusLabels = {
  idle: "尚未加载",
  loading: "加载中",
  loaded: "已加载",
  error: "加载失败",
};

// 只观察加载行为；每个应用调用一次，独立维护自己的记录。
export function createLoadMonitor() {
  const records = createStore<{ items: LocaleLoadRecord[] }>(
    {
      items: [
        { scope: "global", locale: "zh-CN", status: "loaded", calls: 0 },
        { scope: "global", locale: "en-US", status: "idle", calls: 0 },
        { scope: "project", locale: "zh-CN", status: "loaded", calls: 0 },
        { scope: "project", locale: "en-US", status: "idle", calls: 0 },
      ],
    },
    () => {},
  );

  function observe(scope: Scope, loader: LoadMessages): LoadMessages {
    return async (locale = "zh-CN") => {
      if (locale !== "zh-CN" && locale !== "en-US") {
        throw new Error(`Unsupported locale: ${locale}`);
      }
      const update = (status: LocaleLoadRecord["status"]) => {
        records.setState(({ items }) => ({
          items: items.map((item) =>
            item.scope === scope && item.locale === locale
              ? { ...item, status, calls: item.calls + (status === "loading" ? 1 : 0) }
              : item,
          ),
        }));
      };
      update("loading");
      try {
        const messages = await loader(locale);
        update("loaded");
        return messages;
      } catch (error) {
        update("error");
        throw error;
      }
    };
  }

  return { records, observe };
}
