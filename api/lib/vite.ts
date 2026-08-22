import { Hono, type Env } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

export function serveStaticFiles<E extends Env>(app: Hono<E>) {
  // Serve static client assets from dist/public
  app.use("/*", serveStatic({ root: "./dist/public" }));

  // Fallback to index.html for client-side SPA routing
  app.get("*", (c) => {
    const indexPath = path.resolve(process.cwd(), "dist/public/index.html");
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, "utf-8"));
    }
    return c.text("GelombangMaya Production Build - Assets not found. Run npm run build first.", 404);
  });
}
