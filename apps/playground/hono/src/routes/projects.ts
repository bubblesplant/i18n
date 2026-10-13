import type { I18nStore } from "@bubblesjs/i18n-core";
import { Hono } from "hono";
import { createProjectI18n } from "../i18n";
import { getRequestSuccessMessage } from "../i18n/global";
import type { AppEnv } from "../middleware/i18n";

type ProjectEnv = {
  Variables: AppEnv["Variables"] & { projectI18n: I18nStore };
};

const projects = new Hono<ProjectEnv>();

// 局部写法：项目路由使用自己的词条，容器仍然按请求创建。
projects.use("*", async (c, next) => {
  c.set("projectI18n", createProjectI18n(c.get("locale")));
  await next();
});

projects.get("/:id", (c) => {
  const { tr } = c.get("projectI18n").getState();
  return c.json({
    code: "OK",
    locale: c.get("locale"),
    message: getRequestSuccessMessage(c.get("globalI18n")),
    data: {
      id: c.req.param("id"),
      title: tr("项目工作区"),
      greeting: tr("你好，{name}！", { name: c.req.query("name") || "Bubbles" }),
    },
  });
});

export default projects;
