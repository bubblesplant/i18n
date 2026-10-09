import { describe, expect, it, vi } from "vite-plus/test";

import { createStore, shallowEqualObject } from "../src/index";

describe("shallowEqualObject", () => {
  it("比较自有键以及 Object.is 值语义", () => {
    expect(shallowEqualObject({ a: undefined }, { b: undefined })).toBe(false);
    expect(shallowEqualObject({ a: NaN }, { a: NaN })).toBe(true);
    expect(shallowEqualObject({ a: 0 }, { a: -0 })).toBe(false);
    expect(shallowEqualObject({ a: { value: 1 } }, { a: { value: 1 } })).toBe(false);
    expect(shallowEqualObject(null, null)).toBe(false);
    expect(shallowEqualObject(1, 1)).toBe(false);
  });

  it("不可枚举的同名属性不能冒充枚举键", () => {
    const hiddenKey = Object.defineProperty({ y: 2 }, "x", { value: 1 });
    expect(shallowEqualObject<object>({ x: 1 }, hiddenKey)).toBe(false);
    expect(shallowEqualObject<object>(hiddenKey, { x: 1 })).toBe(false);

    const matching = Object.defineProperty({ x: 1 }, "hidden", { value: 2 });
    expect(shallowEqualObject({ x: 1 }, matching)).toBe(true);
  });
});

describe("createStore", () => {
  it("浅相等更新不通知；提交后先持久化回调再通知订阅者", () => {
    const calls: string[] = [];
    const initial = { count: 0 };
    const onChange = vi.fn(({ newState, oldState }) => {
      expect(oldState).toBe(initial);
      expect(newState.count).toBe(1);
      expect(store.getState()).toBe(newState);
      calls.push("onChange");
    });
    const store = createStore(initial, onChange);
    const listener = vi.fn(() => calls.push("listener"));
    store.subscribe(listener);

    store.setState((state) => ({ ...state }));
    expect(store.getState()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    store.setState((state) => ({ count: state.count + 1 }));
    expect(store.getState()).toEqual({ count: 1 });
    expect(calls).toEqual(["onChange", "listener"]);
  });

  it("订阅去重并提供可重复调用的取消函数", () => {
    const store = createStore({ count: 0 }, () => {});
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.subscribe(listener);
    store.setState(() => ({ count: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribe();
    store.setState(() => ({ count: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
