import { describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../src/app";

describe("Hono 请求国际化", () => {
  it("未传语言时默认中文，支持插值", async () => {
    const response = await createApp().request("/api/greeting?name=Alice");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      code: "OK",
      locale: "zh-CN",
      message: "你好，Alice！",
    });
    expect(response.headers.get("Content-Language")).toBe("zh-CN");
    expect(response.headers.get("Vary")).toContain("Accept-Language");
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it.each([
    ["en-US", "en-US", "Hello, Bubbles!"],
    ["EN-us", "en-US", "Hello, Bubbles!"],
    ["en-GB", "en-US", "Hello, Bubbles!"],
    ["zh", "zh-CN", "你好，Bubbles！"],
    ["fr-FR", "zh-CN", "你好，Bubbles！"],
    ["en-US;q=0.2,zh-CN;q=0.9", "zh-CN", "你好，Bubbles！"],
    ["fr-FR,en-US;q=0.8,zh-CN;q=0.5", "en-US", "Hello, Bubbles!"],
    ["en-US;q=0,zh-CN;q=0.5", "zh-CN", "你好，Bubbles！"],
    ["*", "zh-CN", "你好，Bubbles！"],
  ])("按请求头 %s 匹配语言", async (header, locale, message) => {
    const response = await createApp().request("/api/greeting", {
      headers: { "Accept-Language": header },
    });
    expect(await response.json()).toEqual({ code: "OK", locale, message });
    expect(response.headers.get("Content-Language")).toBe(locale);
  });

  it("同一请求同时使用全局词条和局部项目词条", async () => {
    const response = await createApp().request("/api/projects/demo?name=Alice", {
      headers: { "Accept-Language": "en-US" },
    });
    expect(await response.json()).toEqual({
      code: "OK",
      locale: "en-US",
      message: "Request succeeded",
      data: { id: "demo", title: "Project workspace", greeting: "Welcome to the project, Alice!" },
    });
  });

  it("中文项目词条使用独立文案", async () => {
    const response = await createApp().request("/api/projects/demo");
    expect(await response.json()).toMatchObject({
      locale: "zh-CN",
      message: "请求成功",
      data: { title: "项目工作区", greeting: "项目欢迎你，Bubbles！" },
    });
  });

  it("并发请求经过异步业务后仍然保持各自语言", async () => {
    const app = createApp();
    app.get("/api/concurrency", async (c) => {
      const { tr } = c.get("globalI18n").getState();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return c.json({ message: tr("你好，{name}！", { name: c.req.query("name") || "Bubbles" }) });
    });

    const responses = await Promise.all(
      Array.from({ length: 20 }, async (_, index) =>
        app.request(`/api/concurrency?name=User${index}`, {
          headers: { "Accept-Language": index % 2 === 0 ? "en-US" : "zh-CN" },
        }),
      ),
    );
    for (const [index, response] of responses.entries()) {
      expect(await response.json()).toEqual({
        message: index % 2 === 0 ? `Hello, User${index}!` : `你好，User${index}！`,
      });
    }
  });

  it("不存在的接口返回对应语言的 404", async () => {
    const response = await createApp().request("/api/missing", {
      headers: { "Accept-Language": "en-US" },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "NOT_FOUND",
      locale: "en-US",
      message: "Endpoint not found",
    });
  });

  it("异常返回稳定错误码与译文", async () => {
    const app = createApp();
    app.get("/api/failure", () => {
      throw new Error("internal details");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await app.request("/api/failure", {
        headers: { "Accept-Language": "en-US" },
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        code: "INTERNAL_ERROR",
        locale: "en-US",
        message: "Service temporarily unavailable",
      });
    } finally {
      log.mockRestore();
    }
  });

  it.each(["http://localhost:5173", "http://localhost:5175"])(
    "允许 %s 前端跨域调用",
    async (origin) => {
      const response = await createApp().request("/api/greeting", {
        headers: { Origin: origin, "Accept-Language": "en-US" },
      });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Content-Language");
      expect(response.headers.get("Vary")).toContain("Accept-Language");
      expect(response.headers.get("Vary")).toContain("Origin");
    },
  );

  it("支持跨域预检", async () => {
    const response = await createApp().request("/api/greeting", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Accept-Language",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Accept-Language");
  });
});
