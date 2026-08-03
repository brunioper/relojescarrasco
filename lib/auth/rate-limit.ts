import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env";

/**
 * Protección de login contra fuerza bruta, sin estado en servidor
 * (compatible con serverless/Vercel): cookie firmada con HMAC que
 * registra los intentos fallidos y aplica demoras progresivas.
 *
 * Complementa (no reemplaza) los límites propios de Supabase Auth.
 */

const WINDOW_MS = 15 * 60 * 1000; // ventana de 15 minutos
const FREE_ATTEMPTS = 5; // intentos sin demora
const MAX_DELAY_MS = 15 * 60 * 1000; // demora máxima 15 minutos

export const LOGIN_ATTEMPTS_COOKIE = "rc_login_attempts";

type AttemptState = {
  count: number;
  firstAt: number;
  lastAt: number;
};

function secret(): string {
  return serverEnv().RATE_LIMIT_SECRET ?? "dev-only-secret-change-in-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeAttempts(state: AttemptState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeAttempts(cookieValue: string | undefined): AttemptState | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as AttemptState;
    if (
      typeof state.count !== "number" ||
      typeof state.firstAt !== "number" ||
      typeof state.lastAt !== "number"
    ) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** Milisegundos de espera requeridos antes del próximo intento. */
export function requiredDelayMs(state: AttemptState | null, now = Date.now()): number {
  if (!state) return 0;
  if (now - state.firstAt > WINDOW_MS) return 0; // ventana vencida
  if (state.count < FREE_ATTEMPTS) return 0;
  const over = state.count - FREE_ATTEMPTS; // 0, 1, 2, ...
  const delay = Math.min(2 ** over * 2000, MAX_DELAY_MS); // 2s, 4s, 8s, ...
  const elapsed = now - state.lastAt;
  return Math.max(0, delay - elapsed);
}

export function recordFailure(state: AttemptState | null, now = Date.now()): AttemptState {
  if (!state || now - state.firstAt > WINDOW_MS) {
    return { count: 1, firstAt: now, lastAt: now };
  }
  return { count: state.count + 1, firstAt: state.firstAt, lastAt: now };
}
