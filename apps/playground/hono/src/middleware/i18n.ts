import type { I18nStore } from "@bubblesjs/i18n-core";
import { createMiddleware } from "hono/factory";
import { languageDetector } from "hono/language";
import type { LanguageVariables } from "hono/language";
import { createGlobalI18n, supportedLocales } from "../i18n";
import type { SupportedLocale } from "../i18n";

export type AppEnv = {
  Variables: LanguageVariables & {
    locale: SupportedLocale;
    globalI18n: I18nStore;
  };
};

export const detectLanguage = languageDetector({
  supportedLanguages: [...supportedLocales],
  fallbackLanguage: "zh-CN",
  order: ["header"],
  caches: false,
  convertDetectedLanguage(language) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "en") return "en-US";
    if (base === "zh") return "zh-CN";
    return language;
  },
});

export const requestI18n = createMiddleware<AppEnv>(async (c, next) => {
  const locale = c.get("language") === "en-US" ? "en-US" : "zh-CN";
  c.set("locale", locale);
  c.set("globalI18n", createGlobalI18n(locale));
  c.header("Content-Language", locale);
  c.header("Vary", "Accept-Language", { append: true });
  await next();
});
