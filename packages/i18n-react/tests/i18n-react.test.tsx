import { createI18n } from "@bubblesjs/i18n-core";
import type { I18nState } from "@bubblesjs/i18n-core";
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { I18nProvider, useI18n, useI18nStore } from "../src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(node));
  return { container, root };
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("React 国际化适配层", () => {
  test("Provider 翻译插值并在异步加载语言后更新组件", async () => {
    const loaderMessage = vi.fn(async (locale: string | undefined) =>
      locale === "en" ? { greeting: "Hello, {name}" } : { greeting: "你好，{name}" },
    );
    const store = createI18n({
      locale: "zh-CN",
      message: { greeting: "你好，{name}" },
      loaderMessage,
    });
    function Greeting() {
      const { tr, locale, loadLocale } = useI18n();
      return (
        <button onClick={() => void loadLocale("en")}>
          {locale}: {tr("greeting", { name: "Bubbles" })}
        </button>
      );
    }
    const { container } = mount(
      <I18nProvider store={store}>
        <Greeting />
      </I18nProvider>,
    );
    expect(container.textContent).toBe("zh-CN: 你好，Bubbles");

    await act(async () => {
      container.querySelector("button")!.click();
    });

    expect(loaderMessage).toHaveBeenCalledWith("en");
    expect(container.textContent).toBe("en: Hello, Bubbles");
  });

  test("嵌套 Provider 使用最近的容器并隔离语言", async () => {
    const outer = createI18n({ locale: "en", message: { title: "Outer" } });
    const inner = createI18n({ locale: "zh-CN", message: { title: "Inner" } });
    function Label() {
      const { tr } = useI18n();
      return <span>{tr("title")}</span>;
    }
    const { container } = mount(
      <I18nProvider store={outer}>
        <Label />
        <I18nProvider store={inner}>
          <Label />
        </I18nProvider>
      </I18nProvider>,
    );
    expect(container.textContent).toBe("OuterInner");
    await act(async () => {
      await inner.getState().loadLocale("ja");
    });
    expect(container.textContent).toBe("Outertitle");
    expect(outer.getState().locale).toBe("en");
  });

  test("完整状态订阅和选择器订阅都能切换语言", async () => {
    const store = createI18n({ locale: "en" });
    function View() {
      const state = useI18nStore(store);
      const locale = useI18nStore(store, (snapshot) => snapshot.locale);
      return (
        <span>
          {state.locale}/{locale}
        </span>
      );
    }
    const { container } = mount(<View />);
    expect(container.textContent).toBe("en/en");
    await act(async () => {
      await store.getState().loadLocale("zh-CN");
    });
    expect(container.textContent).toBe("zh-CN/zh-CN");
  });

  test("选择器值未变化时不重渲染，变化时更新", async () => {
    const store = createI18n({ locale: "en" });
    const selector = (state: I18nState) => state.locale;
    const render = vi.fn();
    function Locale() {
      const locale = useI18nStore(store, selector);
      render(locale);
      return <span>{locale}</span>;
    }
    const { container } = mount(<Locale />);
    expect(render).toHaveBeenCalledTimes(1);
    await act(async () => {
      await store.getState().loadLocale("en");
    });
    expect(render).toHaveBeenCalledTimes(1);
    await act(async () => {
      await store.getState().loadLocale("zh-CN");
    });
    expect(render).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("zh-CN");
  });

  test("组件卸载时取消外部容器订阅", async () => {
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
    function Locale() {
      const { locale } = useI18nStore(store);
      return <span>{locale}</span>;
    }
    const { root } = mount(<Locale />);
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    await store.getState().loadLocale("zh-CN");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("服务端渲染读取容器首屏快照且不建立订阅", () => {
    const store = createI18n({ locale: "en", message: { title: "Server" } });
    const subscribe = vi.spyOn(store, "subscribe");
    function Title() {
      const { tr } = useI18n();
      return <h1>{tr("title")}</h1>;
    }
    expect(
      renderToString(
        <I18nProvider store={store}>
          <Title />
        </I18nProvider>,
      ),
    ).toBe("<h1>Server</h1>");
    expect(subscribe).not.toHaveBeenCalled();
  });

  test("未提供 Provider 时给出明确错误", () => {
    function MissingProvider() {
      useI18n();
      return null;
    }
    expect(() => renderToString(<MissingProvider />)).toThrow(
      "useI18n must be used within I18nProvider",
    );
  });
});
