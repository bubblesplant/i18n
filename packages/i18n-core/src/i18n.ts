import { formatMessage } from "./format";
import type { MessageValues } from "./format";
import { createStore } from "./store";
import type {
  CreateI18nOptions,
  I18nInitOptions,
  I18nState,
  I18nStore,
  LoadMessages,
  Locale,
  Messages,
} from "./types";

const emptyMessageLoader: LoadMessages = async () => undefined;

/**
 * 创建国际化状态容器，提供翻译、异步切换语言和可选的语言偏好持久化。
 * 接收初始语言和词条，以及可选的词条加载器、存储与存储键。
 * @returns 可被 React 或 Vue 适配层订阅的国际化容器。
 */
export const createI18n = ({
  locale,
  message = {},
  storage,
  storageKey,
  loaderMessage = emptyMessageLoader,
}: CreateI18nOptions = {}): I18nStore => {
  let latestLoad = 0;
  const store: I18nStore = createStore<I18nState>(
    {
      locale,
      message,
      /** 使用当前词条翻译并插值；词条缺失时回退到原始键。 */
      tr: (key: string, values?: MessageValues): string => {
        const messages = store.getState().message;
        return formatMessage(Object.hasOwn(messages, key) ? (messages[key] ?? key) : key, values);
      },
      /** 加载目标语言后更新状态；加载失败时记录警告并切换为空词条。 */
      loadLocale: async (nextLocale) => {
        const loadId = ++latestLoad;
        let nextMessages: Messages = {};
        try {
          nextMessages = (await loaderMessage(nextLocale)) ?? {};
        } catch (error) {
          console.warn(`Failed to load locale file for ${nextLocale}:`, error);
        }
        if (loadId !== latestLoad) return;
        store.setState((state) => ({
          ...state,
          locale: nextLocale,
          message: nextMessages,
        }));
      },
    },
    /** 状态变化后持久化当前语言，供下次初始化恢复偏好。 */
    ({ newState }) => {
      if (storage && storageKey) storage.setItem(storageKey, newState.locale);
    },
  );

  return store;
};

/**
 * 优先恢复持久化的语言偏好，加载首屏词条后创建国际化容器。
 * @param options 默认语言、词条加载器和可选的持久化配置。
 * @returns 完成初始词条加载的容器；加载失败时使用空词条。
 */
export async function initI18n(options: I18nInitOptions = {}): Promise<I18nStore> {
  const { storageKey, storage, locale: defaultLocale, loaderMessage } = options;
  const loadMessages = loaderMessage ?? emptyMessageLoader;
  const locale =
    storageKey && storage ? (storage.getItem<Locale>(storageKey) ?? defaultLocale) : defaultLocale;

  let messages: Messages = {};
  try {
    messages = (await loadMessages(locale)) ?? {};
  } catch (error) {
    console.warn(`Failed to load locale file for ${locale}:`, error);
  }

  return createI18n({
    locale,
    message: messages,
    storage,
    storageKey,
    loaderMessage: loadMessages,
  });
}

export const createI18nStore = createI18n;

export class i18n {
  /** 保留类式初始化入口，等待初始语言加载完成后返回容器。 */
  static init(options?: I18nInitOptions): Promise<I18nStore> {
    return initI18n(options);
  }
}
