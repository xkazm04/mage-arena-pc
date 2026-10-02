import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createCampRuntime,
  SaveStore, restoreSave,
  type SeasonService,
  type SeasonCommand,
  type ParleyInput,
  type CampCommand,
} from "@mage/director";
import { campPlay, bridgeRules, type BoutInput } from "@mage/core";

export function campApi() {
  const saves = new SaveStore();
  const sessions = new Map<string, SeasonService>();
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
        service = createCampRuntime();
        sessions.set(id, service);
        res.setHeader(
          "set-cookie",
          `camp=${id}; HttpOnly; SameSite=Strict; Path=/`,
        );
      }
      if (!service) return send(409, { error: "Return to camp to begin." });
      if (req.method === "GET" && req.url === "/api/session")
        return send(200, service.view());
      if (req.method === "GET" && req.url === "/api/bout")
        return send(200, service.progress.bout);
      if (
        req.method !== "POST" ||
        req.headers["content-type"] !== "application/json"
      )
        return send(400, { error: "Unknown camp action." });
      let body = "";
      for await (const part of req) {
        body += String(part);
        if (body.length > bridgeRules.limits.maxBodyBytes)
          return send(413, { error: "That message is too long." });
      }
      const payload = JSON.parse(body) as Record<string, unknown>;
      if (req.url === '/api/save') return send(200, saves.write(service));
      if (req.url === '/api/load' || req.url === '/api/load-previous') {
        restoreSave(service, saves.read(service.tables, req.url.endsWith('-previous')));
        return send(200, service.view());
      }
      if (req.url === '/api/season') return send(200, service.seasonCommand(payload.command as SeasonCommand, payload.revision as number));
      if (req.url === '/api/bout-input') return send(200, service.boutInputs(payload.id as string, payload.entries as BoutInput[], payload.hash as string));
      if (req.url === '/api/pause') { service.paused = payload.paused === true; return send(200, service.view()); }
      if (req.url === "/api/parley")
        return send(
          200,
          await service.parley(
            payload.input as ParleyInput,
            payload.revision as number,
          ),
        );
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
