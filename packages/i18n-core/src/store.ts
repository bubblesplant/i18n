export type StoreListener = () => void;

export interface Store<T extends object> {
  getState: () => T;
  setState: (updater: (state: T) => T) => void;
  subscribe: (listener: StoreListener) => () => void;
}

/** 比较对象的可枚举字符串键数量与对应值；非对象输入返回 `false`。 */
export const shallowEqualObject = <T>(a: T, b: T): boolean => {
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  const aKeys = Object.keys(a);

  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }

  return aKeys.every(
    (key) =>
      Object.prototype.propertyIsEnumerable.call(b, key) &&
      Object.is(a[key as keyof T], b[key as keyof T]),
  );
};

/**
 * 创建可订阅的内存状态容器，仅在浅比较发现变化时通知订阅者。
 * @param initState 初始状态。
 * @param onChange 状态提交后、订阅者通知前执行的回调。
 * @returns 提供状态读取、函数式更新和取消订阅能力的容器。
 */
export function createStore<T extends object>(
  initState: T,
  onChange: ({ newState, oldState }: { newState: T; oldState: T }) => void,
): Store<T> {
  let state = initState;
  const listeners = new Set<StoreListener>();

  return {
    getState: () => state,
    /** 通过更新函数计算新状态，跳过浅相等结果，并同步通知变更。 */
    setState: (updater) => {
      const oldState = state;
      const newState = updater(oldState);
      if (shallowEqualObject(newState, oldState)) return;

      state = newState;
      onChange({ newState, oldState });
      for (const listener of listeners) listener();
    },
    /** 注册状态变化监听器，返回移除该监听器的清理函数。 */
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
