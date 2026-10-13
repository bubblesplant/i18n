import { Hono } from "hono";
import { cors } from "hono/cors";
import { createGlobalI18n, supportedLocales } from "./i18n";
import { detectLanguage, requestI18n } from "./middleware/i18n";
import type { AppEnv } from "./middleware/i18n";
import projects from "./routes/projects";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:5175"],
      allowMethods: ["GET", "OPTIONS"],
      allowHeaders: ["Accept-Language"],
      exposeHeaders: ["Content-Language"],
    }),
  );
  app.use("*", detectLanguage, requestI18n);

  app.get("/", (c) =>
    c.json({
      name: "BubblesJS i18n · Hono + Vite+",
      locale: c.get("locale"),
      supportedLocales,
      endpoints: ["/api/greeting?name=Bubbles", "/api/projects/demo?name=Bubbles"],
    }),
  );

  app.get("/api/greeting", (c) => {
    const { tr } = c.get("globalI18n").getState();
    return c.json({
      code: "OK",
      locale: c.get("locale"),
      message: tr("你好，{name}！", { name: c.req.query("name") || "Bubbles" }),
    });
  });

  app.route("/api/projects", projects);

  app.notFound((c) => {
    const { tr } = c.get("globalI18n").getState();
    return c.json({ code: "NOT_FOUND", locale: c.get("locale"), message: tr("接口不存在") }, 404);
  });

  app.onError((error, c) => {
    console.error(error);
    const store = c.get("globalI18n") ?? createGlobalI18n("zh-CN");
    const { tr, locale } = store.getState();
    return c.json({ code: "INTERNAL_ERROR", locale, message: tr("服务暂时不可用") }, 500);
  });

  return app;
}

export default createApp();
