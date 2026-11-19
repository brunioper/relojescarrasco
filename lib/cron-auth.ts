import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Las tareas programadas de GitHub Actions (Instagram, reels) llaman al
 * sitio con "Authorization: Bearer <CRON_SECRET>".
 */

const digest = (value: string) => createHash("sha256").update(value).digest();

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string };

export function checkCronAuth(request: Request): CronAuth {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || secret.length < 24) {
    return { ok: false, status: 503, error: "CRON_SECRET no configurado." };
  }
  const header = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) {
    return { ok: false, status: 401, error: "No autorizado." };
  }
  return { ok: true };
}
