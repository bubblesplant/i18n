import {
  computed,
  defineComponent,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from "vue";
import type { I18nState, I18nStore } from "@bubblesjs/i18n-core";
import { useI18nStore } from "./use-store";

export const I18nKey: InjectionKey<I18nStore> = Symbol("i18n");

export interface I18nProviderProps {
  store: I18nStore;
}

export interface UseI18nReturn {
  tr: I18nState["tr"];
  loadLocale: I18nState["loadLocale"];
  locale: ComputedRef<I18nState["locale"]>;
}

export const I18nProvider = defineComponent({
  name: "I18nProvider",
  props: {
    store: {
      type: Object as PropType<I18nStore>,
      required: true,
    },
  },
  /** 为后代组件注入国际化容器，并原样渲染默认插槽。 */
  setup(props, { slots }) {
    provide(I18nKey, props.store);
    return () => slots.default?.();
  },
});

/**
 * 订阅注入的国际化容器，提供始终读取最新词条的翻译和语言切换方法。
 * @returns 翻译方法、异步语言切换方法和响应式语言引用。
 * @throws 未被 `I18nProvider` 包裹时抛出错误。
 */
export function useI18n(): UseI18nReturn {
  const store = inject(I18nKey);
  if (!store) throw new Error("useI18n must be used within I18nProvider");

  const state = useI18nStore(store);
  const tr: I18nState["tr"] = (key, values) => state.value.tr(key, values);
  const loadLocale: I18nState["loadLocale"] = (locale) => state.value.loadLocale(locale);
  const locale = computed(() => state.value.locale);

  return { tr, loadLocale, locale };
}

export { useI18nStore } from "./use-store";
export default I18nProvider;
