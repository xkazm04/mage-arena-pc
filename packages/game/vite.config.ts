import { defineConfig, type Plugin } from "vite";
import { cpSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
import { campApi } from "./server/api.ts";
const root = fileURLToPath(new URL(".", import.meta.url));
const assets = resolve(root, "../../assets");
function campServer(): Plugin {
  return {
    name: "camp-sidecar",
    configureServer(server) {
      const api = campApi();
      server.httpServer?.on("close", () => api.close());
      server.middlewares.use((req, res, next) => {
        void api.handle(req, res, next);
      });
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/assets/accepted/camp/")) return next();
        const filename = req.url.slice("/assets/".length);
        if (!/^accepted\/camp\/[a-z0-9.-]+$/.test(filename)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const types: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".json": "application/json",
          };
          res.setHeader(
            "content-type",
            types[extname(filename)] ?? "application/octet-stream",
          );
          res.end(readFileSync(resolve(assets, filename)));
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
    closeBundle() {
      cpSync(assets, resolve(root, "../../dist/game/assets"), {
        recursive: true,
      });
    },
  };
}
export default defineConfig({
  root,
  publicDir: "public",
  plugins: [campServer()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "../../dist/game", emptyOutDir: true },
});
