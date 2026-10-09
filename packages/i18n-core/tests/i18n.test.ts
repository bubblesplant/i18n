import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createI18n,
  createI18nStore,
  createJsonStorage,
  i18n,
  initI18n,
  type Messages,
} from "../src/index";

afterEach(() => vi.restoreAllMocks());

describe("createI18n", () => {
  it("翻译、插值、空词条及缺失键回退", () => {
    const store = createI18n({
      locale: "zh-CN",
      message: { hello: "你好，{name}", empty: "" },
    });
    const { tr } = store.getState();
    expect(tr("hello", { name: "小明" })).toBe("你好，小明");
    expect(tr("empty")).toBe("");
    expect(tr("missing")).toBe("missing");
    expect(tr("未知：{count}", { count: 0 })).toBe("未知：0");
    expect(tr("toString")).toBe("toString");
    expect(tr("constructor")).toBe("constructor");
  });

  it("省略选项时可工作，并保留旧入口", async () => {
    expect(createI18nStore).toBe(createI18n);
    const store = createI18n();
    expect(store.getState().locale).toBeUndefined();
    expect(store.getState().tr("hello")).toBe("hello");
    await store.getState().loadLocale("en-US");
    expect(store.getState().locale).toBe("en-US");
    expect((await i18n.init()).getState().message).toEqual({});
  });

  it("等待异步词条后更新语言，旧 tr 引用读取最新状态", async () => {
    const loaderMessage = vi.fn(async (locale) => ({ hello: `hello ${locale}` }));
    const store = createI18n({ locale: "zh-CN", message: { hello: "你好" }, loaderMessage });
    const { tr, loadLocale } = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    const switching = loadLocale("en-US");
    expect(store.getState().locale).toBe("zh-CN");
    expect(tr("hello")).toBe("你好");
    await switching;
    expect(loaderMessage).toHaveBeenCalledWith("en-US");
    expect(store.getState().locale).toBe("en-US");
    expect(tr("hello")).toBe("hello en-US");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("加载结果为空或失败时切换语言，使用空词条回退", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new Error("locale missing");
    const loaderMessage = vi.fn(async () => undefined);
    const store = createI18n({ message: { hello: "你好" }, loaderMessage });
    await store.getState().loadLocale("en-US");
    expect(store.getState().message).toEqual({});
    loaderMessage.mockRejectedValueOnce(failure);
    await expect(store.getState().loadLocale("fr-FR")).resolves.toBeUndefined();
    expect(store.getState().locale).toBe("fr-FR");
    expect(store.getState().tr("hello")).toBe("hello");
    expect(warning).toHaveBeenCalledWith("Failed to load locale file for fr-FR:", failure);
  });

  it("并发切换时最后请求的语言获胜，过期结果不通知或持久化", async () => {
    const pending = new Map<string, (messages: Messages) => void>();
    const loaderMessage = (locale?: string) =>
      new Promise<Messages>((resolve) => pending.set(locale ?? "", resolve));
    const storage = createJsonStorage();
    const persisted = vi.spyOn(storage, "setItem");
    const store = createI18n({ locale: "zh-CN", loaderMessage, storage, storageKey: "language" });
    const listener = vi.fn();
    store.subscribe(listener);
    const slow = store.getState().loadLocale("en-US");
    const fast = store.getState().loadLocale("fr-FR");
    pending.get("fr-FR")?.({ hello: "Bonjour" });
    await fast;
    pending.get("en-US")?.({ hello: "Hello" });
    await slow;
    expect(store.getState().locale).toBe("fr-FR");
    expect(store.getState().tr("hello")).toBe("Bonjour");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(persisted).toHaveBeenCalledExactlyOnceWith("language", "fr-FR");
  });
});

describe("initI18n", () => {
  it("优先恢复持久化语言并在切换成功后保存", async () => {
    const items = new Map<string, string>([["language", '"en-US"']]);
    const storage = createJsonStorage({
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value);
      },
      removeItem: (key) => {
        items.delete(key);
      },
    });
    const loaderMessage = vi.fn(async (locale) => ({ hello: `hello ${locale}` }));
    const store = await initI18n({
      locale: "zh-CN",
      loaderMessage,
      storage,
      storageKey: "language",
    });
    expect(loaderMessage).toHaveBeenCalledWith("en-US");
    expect(store.getState().locale).toBe("en-US");
    expect(store.getState().tr("hello")).toBe("hello en-US");
    await store.getState().loadLocale("zh-CN");
    expect(items.get("language")).toBe('"zh-CN"');
  });

  it("没有持久化值时使用默认语言，初始化加载失败仍返回可用容器", async () => {
    const failure = new Error("network");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaderMessage = vi.fn(async () => {
      throw failure;
    });
    const store = await initI18n({
      locale: "zh-CN",
      loaderMessage,
      storage: createJsonStorage(),
      storageKey: "language",
    });
    expect(loaderMessage).toHaveBeenCalledWith("zh-CN");
    expect(store.getState().locale).toBe("zh-CN");
    expect(store.getState().tr("hello")).toBe("hello");
    expect(warning).toHaveBeenCalledWith("Failed to load locale file for zh-CN:", failure);
  });
});
