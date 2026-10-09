import { createI18n } from "@bubblesjs/i18n-core";
import { createApp, defineComponent, effectScope, h, nextTick } from "vue";
import type { App, Component } from "vue";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { I18nProvider, useI18n, useI18nStore } from "../src/index";

const apps: App[] = [];

function mount(component: Component) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp(component);
  apps.push(app);
  app.mount(container);
  return { app, container };
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Vue 国际化适配层", () => {
  test("Provider 翻译插值，异步切换语言会更新 locale 和词条", async () => {
    const loaderMessage = vi.fn(async (locale: string | undefined) =>
      locale === "en" ? { greeting: "Hello, {name}" } : { greeting: "你好，{name}" },
    );
    const store = createI18n({
      locale: "zh-CN",
      message: { greeting: "你好，{name}" },
      loaderMessage,
    });
    const Greeting = defineComponent({
      setup() {
        const { tr, locale, loadLocale } = useI18n();
        return () =>
          h(
            "button",
            { onClick: () => void loadLocale("en") },
            `${locale.value}: ${tr("greeting", { name: "Bubbles" })}`,
          );
      },
    });
    const { container } = mount(
      defineComponent({
        setup: () => () => h(I18nProvider, { store }, { default: () => h(Greeting) }),
      }),
    );
    expect(container.textContent).toBe("zh-CN: 你好，Bubbles");
    container.querySelector("button")!.click();
    await vi.waitFor(() => expect(container.textContent).toBe("en: Hello, Bubbles"));
    expect(loaderMessage).toHaveBeenCalledWith("en");
  });

  test("嵌套 Provider 为不同子树提供独立容器", async () => {
    const outer = createI18n({ locale: "en", message: { title: "Outer" } });
    const inner = createI18n({ locale: "zh-CN", message: { title: "Inner" } });
    const Label = defineComponent({
      setup() {
        const { tr } = useI18n();
        return () => h("span", tr("title"));
      },
    });
    const { container } = mount(
      defineComponent({
        setup: () => () =>
          h(
            I18nProvider,
            { store: outer },
            {
              default: () => [
                h(Label),
                h(I18nProvider, { store: inner }, { default: () => h(Label) }),
              ],
            },
          ),
      }),
    );
    expect(container.textContent).toBe("OuterInner");
    await inner.getState().loadLocale("ja");
    await nextTick();
    expect(container.textContent).toBe("Outertitle");
    expect(outer.getState().locale).toBe("en");
  });

  test("完整状态和选择器引用在 effectScope 中保持响应式", async () => {
    const store = createI18n({ locale: "en" });
    const scope = effectScope();
    const subscriptions = scope.run(() => ({
      state: useI18nStore(store),
      locale: useI18nStore(store, (state) => state.locale),
    }))!;
    expect(subscriptions.state.value.locale).toBe("en");
    expect(subscriptions.locale.value).toBe("en");
    await store.getState().loadLocale("zh-CN");
    expect(subscriptions.state.value.locale).toBe("zh-CN");
    expect(subscriptions.locale.value).toBe("zh-CN");
    scope.stop();
    await store.getState().loadLocale("ja");
    expect(subscriptions.state.value.locale).toBe("zh-CN");
    expect(subscriptions.locale.value).toBe("zh-CN");
  });

  test("同一个语言选择器不因词条更新而重渲染组件", async () => {
    const store = createI18n({ locale: "en" });
    const render = vi.fn();
    const Locale = defineComponent({
      setup() {
        const locale = useI18nStore(store, (state) => state.locale);
        return () => {
          render(locale.value);
          return h("span", locale.value);
        };
      },
    });
    const { container } = mount(Locale);
    expect(render).toHaveBeenCalledTimes(1);
    await store.getState().loadLocale("en");
    await nextTick();
    expect(render).toHaveBeenCalledTimes(1);
    await store.getState().loadLocale("zh-CN");
    await nextTick();
    expect(render).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("zh-CN");
  });

  test("组件卸载时取消订阅，后续容器更新不再触发组件", async () => {
    const store = createI18n({ locale: "en" });
    const subscribe = store.subscribe;
    const cleanup = vi.fn();
    vi.spyOn(store, "subscribe").mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      return () => {
        cleanup();
        unsubscribe();
      };
    });
    const render = vi.fn();
    const Locale = defineComponent({
      setup() {
        const state = useI18nStore(store);
        return () => {
          render(state.value.locale);
          return h("span", state.value.locale);
        };
      },
    });
    const { app } = mount(Locale);
    app.unmount();
    apps.splice(apps.indexOf(app), 1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    await store.getState().loadLocale("zh-CN");
    await nextTick();
    expect(render).toHaveBeenCalledTimes(1);
  });

  test("缺少 Provider 时明确报错", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const MissingProvider = defineComponent({
      setup() {
        useI18n();
        return () => null;
      },
    });
    expect(() => mount(MissingProvider)).toThrow("useI18n must be used within I18nProvider");
    // 安装失败的应用没有组件实例，无需在 afterEach 中再次卸载。
    apps.pop();
  });
});
