export interface I18nProjectConfig {
  include: readonly string[];
  exclude?: readonly string[];
  catalogs: Readonly<Record<string, string>>;
}

export interface I18nConfig {
  callNames?: readonly string[];
  projects: Readonly<Record<string, I18nProjectConfig>>;
  report?: string;
}

/** 原样返回国际化配置，同时保留字面量类型以提供配置校验和编辑器提示。 */
export function defineConfig<const Config extends I18nConfig>(config: Config): Config {
  return config;
}
