export type MessageValues = Record<string, string | number>;

/** 替换消息中的 `{key}` 占位符；未提供对应值时保留原占位符。 */
export function formatMessage(message: string, values?: MessageValues): string {
  if (!values) return message;

  return message.replace(/\{(\w+)\}/g, (match, key: string) => {
    return Object.hasOwn(values, key) ? String(values[key] ?? match) : match;
  });
}
