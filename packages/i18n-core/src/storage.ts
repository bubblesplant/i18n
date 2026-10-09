export interface StateStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface JsonStorage {
  getItem: <T>(key: string) => T | null;
  setItem: <T>(key: string, value: T) => void;
  removeItem: (key: string) => void;
}

/**
 * 为字符串存储添加 JSON 序列化，并隔离存储访问和序列化异常。
 * @param storage 可选的底层存储；未传入时读取为空、写入无操作。
 * @returns 读取失败时清理对应缓存并返回 `null` 的存储适配器。
 */
export const createJsonStorage = (storage?: StateStorage): JsonStorage => {
  /** 尝试移除指定缓存，忽略底层存储异常以免中断页面渲染。 */
  const removeItem = (key: string) => {
    try {
      storage?.removeItem(key);
    } catch {
      // Persistence must never interrupt application rendering.
    }
  };

  return {
    /** 解析缓存 JSON；缓存缺失返回 `null`，读取或解析异常时尝试清理缓存。 */
    getItem: <T>(key: string) => {
      try {
        const value = storage?.getItem(key);
        if (value === undefined || value === null) return null;
        return JSON.parse(value) as T;
      } catch {
        removeItem(key);
        return null;
      }
    },
    /** 写入序列化后的值；结果为 `undefined` 时删除缓存，异常时忽略此次写入。 */
    setItem: <T>(key: string, value: T) => {
      try {
        const json = JSON.stringify(value);
        if (json === undefined) {
          removeItem(key);
          return;
        }
        storage?.setItem(key, json);
      } catch {
        // Persistence must never interrupt application rendering.
      }
    },
    removeItem,
  };
};
