import { describe, expect, it } from "vite-plus/test";

import { defineConfig, type I18nExcelConfig } from "../src/config.ts";

describe("defineConfig", () => {
  it("returns the same config object", () => {
    const config = {
      callNames: ["tr"],
      projects: {
        web: {
          include: ["apps/web/src/**/*.ts"],
          catalogs: { en_US: "apps/web/src/locales/en_US.json" },
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
  });

  it("accepts an Excel-only project without scan rules", () => {
    const excel = {
      file: "translations/web.xlsx",
      sheet: "translations",
    } satisfies I18nExcelConfig;
    const config = {
      projects: {
        web: {
          catalogs: { en_US: "locales/en_US.json" },
          excel,
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
  });

  it("accepts omitted and partial Excel settings without filling defaults into the config", () => {
    const config = {
      projects: {
        omitted: { catalogs: { en: "omitted.json" } },
        empty: { catalogs: { en: "empty.json" }, excel: {} satisfies I18nExcelConfig },
        sheet: {
          catalogs: { en: "sheet.json" },
          excel: { sheet: "译文" } satisfies I18nExcelConfig,
        },
        file: {
          catalogs: { en: "file.json" },
          excel: { file: "custom.xlsx" } satisfies I18nExcelConfig,
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
    expect(config.projects.empty.excel).toEqual({});
    expect(config.projects.sheet.excel).toEqual({ sheet: "译文" });
  });
});
