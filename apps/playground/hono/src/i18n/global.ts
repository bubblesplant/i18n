import type { I18nStore } from "@bubblesjs/i18n-core";

// 全局翻译调用单独放置，让 CLI 与运行时使用相同的词条作用域。
export function getRequestSuccessMessage(store: I18nStore): string {
  const { tr } = store.getState();
  return tr("请求成功");
}
