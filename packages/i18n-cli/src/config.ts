export const DEFAULT_EXCEL_SHEET = "sheet1";

export interface I18nExcelConfig {
  /** Excel 文件路径，默认 .bubbles-i18n/<项目名>.xlsx，相对配置文件目录解析。 */
  file?: string;
  /** 工作表名称，默认 sheet1。 */
  sheet?: string;
}

export interface I18nProjectConfig {
  include?: readonly string[];
  exclude?: readonly string[];
  catalogs: Readonly<Record<string, string>>;
  /** 可省略，默认使用 .bubbles-i18n/<项目名>.xlsx 和 sheet1。 */
  excel?: I18nExcelConfig;
}

export interface I18nConfig {
  callNames?: readonly string[];
  projects: Readonly<Record<string, I18nProjectConfig>>;
  /** 扫描 JSON 报告路径，默认 .bubbles-i18n/report.json；false 表示关闭。 */
  report?: string | false;
}

/** 原样返回国际化配置，同时保留字面量类型以提供配置校验和编辑器提示。 */
export function defineConfig<const Config extends I18nConfig>(config: Config): Config {
  return config;
}
