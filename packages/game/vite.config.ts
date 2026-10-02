import { defineConfig, type Plugin } from "vite";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
import { campApi } from "./server/api.ts";
const root = fileURLToPath(new URL(".", import.meta.url));
const assets = resolve(root, "../../assets");
const uiKit = resolve(assets, "accepted/covenant/ui");
function campServer(): Plugin {
  return {
    name: "camp-sidecar",
    configurePreviewServer(server) {
      const api = campApi();
      server.httpServer.on("close", () => api.close());
      server.middlewares.use((req, res, next) => {
        void api.handle(req, res, next);
      });
    },
    configureServer(server) {
      const api = campApi();
      server.httpServer?.on("close", () => api.close());
      server.middlewares.use((req, res, next) => {
        void api.handle(req, res, next);
      });
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/art/ui/")) {
          const name = req.url.slice("/art/ui/".length).split("?")[0]!;
          if (
            !/^[a-zA-Z0-9_/-]+\.(json|png|ttf|woff2)$/.test(name) ||
            name.split("/").some((p) => p === "..")
          ) {
            res.statusCode = 404;
            res.end();
            return;
          }
          try {
            res.setHeader(
              "content-type",
              name.endsWith(".json")
                ? "application/json"
                : name.endsWith(".png")
                  ? "image/png"
                  : "application/octet-stream",
            );
            res.end(readFileSync(resolve(uiKit, name)));
          } catch {
            res.statusCode = 404;
            res.end();
          }
          return;
        }
        if (!req.url?.startsWith("/assets/accepted/")) return next();
        const filename = req.url.slice("/assets/".length).split("?")[0]!;
        if (
          !/^accepted\/(camp|covenant)\/[a-zA-Z0-9/_.-]+$/.test(filename) ||
          filename.includes("..")
        ) {
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
      if (existsSync(uiKit))
        cpSync(uiKit, resolve(root, "../../dist/game/art/ui"), {
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
