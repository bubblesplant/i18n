import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "./use-store";

export interface I18nProviderProps {
  children: ReactNode;
  store: I18nStore;
}

export const I18nContext = createContext<I18nStore | undefined>(undefined);

/**
 * 订阅最近的国际化上下文，返回翻译方法、语言切换方法和当前语言。
 * @throws 未被 `I18nProvider` 包裹时抛出错误。
 */
export const useI18n = () => {
  const store = useContext(I18nContext);
  if (!store) throw new Error("useI18n must be used within I18nProvider");

  const { tr, loadLocale, locale } = useI18nStore(store);
  return { tr, loadLocale, locale };
};

/** 向子组件提供指定的国际化容器，允许不同子树使用独立的语言状态。 */
export const I18nProvider = ({ children, store }: I18nProviderProps) => {
  return <I18nContext.Provider value={store}>{children}</I18nContext.Provider>;
};

export { useI18nStore } from "./use-store";
export default I18nProvider;
