import { describe, expect, it, vi } from "vite-plus/test";

import { createJsonStorage, type StateStorage } from "../src/index";

function memoryStorage() {
  const items = new Map<string, string>();
  const storage: StateStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: vi.fn((key) => items.delete(key)),
  };
  return { items, storage };
}

describe("createJsonStorage", () => {
  it("序列化、读取和删除存储值", () => {
    const { items, storage } = memoryStorage();
    const json = createJsonStorage(storage);
    json.setItem("locale", "zh-CN");
    expect(items.get("locale")).toBe('"zh-CN"');
    expect(json.getItem<string>("locale")).toBe("zh-CN");
    json.setItem("object", { count: 0 });
    expect(json.getItem("object")).toEqual({ count: 0 });
    json.removeItem("locale");
    expect(json.getItem("locale")).toBeNull();
  });

  it("缺失值返回 null，损坏 JSON 自动清理，undefined 删除旧值", () => {
    const { items, storage } = memoryStorage();
    const json = createJsonStorage(storage);
    expect(json.getItem("missing")).toBeNull();
    items.set("broken", "{broken");
    expect(json.getItem("broken")).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("broken");
    expect(items.has("broken")).toBe(false);
    json.setItem("locale", "en-US");
    json.setItem("locale", undefined);
    expect(items.has("locale")).toBe(false);
  });

  it("底层读写删除异常和 JSON 序列化异常不会传播", () => {
    const fail = () => {
      throw new Error("storage disabled");
    };
    const json = createJsonStorage({ getItem: fail, setItem: fail, removeItem: fail });
    expect(json.getItem("locale")).toBeNull();
    expect(() => json.setItem("locale", "en-US")).not.toThrow();
    expect(() => json.removeItem("locale")).not.toThrow();
    expect(() => json.setItem("unsupported", 1n)).not.toThrow();
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => json.setItem("circular", circular)).not.toThrow();
  });

  it("未提供底层存储时适用于 SSR", () => {
    const json = createJsonStorage();
    expect(json.getItem("locale")).toBeNull();
    expect(() => json.setItem("locale", "zh-CN")).not.toThrow();
    expect(() => json.removeItem("locale")).not.toThrow();
  });
});
