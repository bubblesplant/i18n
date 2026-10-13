import { createI18n } from "@bubblesjs/i18n-core";
import globalEnUS from "../locales/global/en-US.json";
import globalZhCN from "../locales/global/zh-CN.json";
import projectEnUS from "../locales/project/en-US.json";
import projectZhCN from "../locales/project/zh-CN.json";

export const supportedLocales = ["zh-CN", "en-US"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

// 词条在模块加载时导入并共享；容器由工厂按请求创建。
const globalMessages = { "zh-CN": globalZhCN, "en-US": globalEnUS };
const projectMessages = { "zh-CN": projectZhCN, "en-US": projectEnUS };

export function createGlobalI18n(locale: SupportedLocale) {
  return createI18n({ locale, message: globalMessages[locale] });
}

export function createProjectI18n(locale: SupportedLocale) {
  return createI18n({ locale, message: projectMessages[locale] });
}
