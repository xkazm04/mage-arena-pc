import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  CampService,
  CostGuard,
  loadTables,
  OllamaProvider,
  PlannerProvider,
  RequestCache,
  type CampCommand,
} from "@mage/director";
import config from "../../director/src/config.json" with { type: "json" };
import { campPlay } from "@mage/core";

export function campApi() {
  const tables = loadTables();
  const sessions = new Map<string, CampService>();
  const timer = setInterval(() => {
    for (const service of sessions.values()) service.tick();
  }, campPlay.listening.tickMs);
  timer.unref();
  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    if (!req.url?.startsWith("/api/")) return next();
    const send = (status: number, value: unknown) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`
      )
        return send(403, { error: "This camp belongs to another window." });
      let id = req.headers.cookie?.match(/(?:^|; )camp=([a-f0-9-]+)/)?.[1];
      let service = id ? sessions.get(id) : undefined;
      if (req.url === "/api/session" && req.method === "GET" && !service) {
        if (sessions.size >= 32)
          return send(503, {
            error: "Too many open camps. Restart the camp server.",
          });
        id = randomUUID();
        const mode =
          process.env.CAMP_DIRECTOR === "local" ? "local" : "offline";
        service = new CampService(tables, {
          provider:
            mode === "local"
              ? new OllamaProvider()
              : new PlannerProvider(tables, () => service!.session.camp),
          cache: new RequestCache(".director-runtime/camp-cache"),
          guard: new CostGuard(
            ".director-runtime/camp-ledger.json",
            "camp-play",
            mode,
            config.budget.game.runCalls,
            config.budget.game.dayCalls,
          ),
        });
        sessions.set(id, service);
        res.setHeader(
          "set-cookie",
          `camp=${id}; HttpOnly; SameSite=Strict; Path=/`,
        );
      }
      if (!service) return send(409, { error: "Return to camp to begin." });
      if (req.method === "GET" && req.url === "/api/session")
        return send(200, service.view());
      if (
        req.method !== "POST" ||
        req.headers["content-type"] !== "application/json"
      )
        return send(400, { error: "Unknown camp action." });
      let body = "";
      for await (const part of req) {
        body += String(part);
        if (body.length > 8192)
          return send(413, { error: "That message is too long." });
      }
      const payload = JSON.parse(body) as Record<string, unknown>;
      if (req.url === "/api/input") {
        service.control(
          payload.lane as number,
          payload.listening as boolean,
          payload.day as number,
        );
        return send(200, { ok: true });
      }
      if (req.url === "/api/command")
        return send(
          200,
          await service.command(
            payload.command as CampCommand,
            payload.revision as number,
          ),
        );
      return send(404, { error: "That path is closed." });
    } catch (error) {
      send(409, {
        error:
          error instanceof Error
            ? error.message
            : "The camp could not complete that action.",
      });
    }
  }
  return {
    handle,
    close() {
      clearInterval(timer);
      for (const service of sessions.values()) service.close();
    },
  };
}
