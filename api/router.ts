import { createRouter, publicQuery } from "./middleware";
import { siemRouter } from "./siem";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now(), service: "GelombangMaya SIEM" })),
  siem: siemRouter,
});

export type AppRouter = typeof appRouter;
