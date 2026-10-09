import { computed, onScopeDispose, shallowRef } from "vue";
import type { ComputedRef, ShallowRef } from "vue";
import type { I18nState, I18nStore } from "@bubblesjs/i18n-core";

/** 订阅国际化容器，并以计算属性返回选择器提取的状态。 */
export function useI18nStore<T>(
  store: I18nStore,
  selector: (state: I18nState) => T,
): ComputedRef<T>;
/** 订阅国际化容器，并以浅引用返回完整状态。 */
export function useI18nStore(store: I18nStore): ShallowRef<I18nState>;
/** 将容器状态接入 Vue 响应系统，并在当前作用域销毁时自动取消订阅。 */
export function useI18nStore<T>(
  store: I18nStore,
  selector?: (state: I18nState) => T,
): ComputedRef<T> | ShallowRef<I18nState> {
  const state = shallowRef<I18nState>(store.getState());
  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });

  onScopeDispose(unsubscribe);

  return selector ? computed(() => selector(state.value)) : state;
}
