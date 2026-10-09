import { describe, expect, it } from "vite-plus/test";

import { formatMessage } from "../src/index";

describe("formatMessage", () => {
  it("替换重复占位符，保留 0、空字符串和缺失参数", () => {
    expect(
      formatMessage("{name}/{name}/{count}/{empty}/{unknown}", {
        name: "小明",
        count: 0,
        empty: "",
      }),
    ).toBe("小明/小明/0//{unknown}");
  });

  it("不提供参数时保持原字符串", () => {
    expect(formatMessage("你好，{name}")).toBe("你好，{name}");
  });

  it("只替换自有参数，防止原型属性被当作插值", () => {
    expect(formatMessage("{toString}/{constructor}", {})).toBe("{toString}/{constructor}");
  });
});
