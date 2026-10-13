import { serve } from "@hono/node-server";
import app from "./app";

const port = Number(process.env.PORT ?? 5176);
const hostname = process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必须是 1 到 65535 之间的整数");
}

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`Hono playground: http://${hostname}:${info.port}`);
});
