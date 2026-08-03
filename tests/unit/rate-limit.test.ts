import { beforeEach, describe, expect, it, vi } from "vitest";

// El módulo usa serverEnv(); se define el secreto antes de importar.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(30);
process.env.SUPABASE_SERVICE_ROLE_KEY = "y".repeat(30);
process.env.RATE_LIMIT_SECRET = "test-secret-for-unit-tests-123456";

const { decodeAttempts, encodeAttempts, recordFailure, requiredDelayMs } = await import(
  "@/lib/auth/rate-limit"
);

describe("rate limiting de login", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("la cookie firmada se decodifica correctamente", () => {
    const state = { count: 3, firstAt: 1000, lastAt: 2000 };
    const encoded = encodeAttempts(state);
    expect(decodeAttempts(encoded)).toEqual(state);
  });

  it("una cookie manipulada se descarta", () => {
    const encoded = encodeAttempts({ count: 3, firstAt: 1000, lastAt: 2000 });
    const [payload] = encoded.split(".");
    const forged = Buffer.from(JSON.stringify({ count: 0, firstAt: 1000, lastAt: 2000 }))
      .toString("base64url");
    expect(decodeAttempts(`${forged}.${encoded.split(".")[1]}`)).toBeNull();
    expect(decodeAttempts(`${payload}.firma-falsa`)).toBeNull();
    expect(decodeAttempts("basura")).toBeNull();
    expect(decodeAttempts(undefined)).toBeNull();
  });

  it("los primeros 5 intentos no tienen demora", () => {
    const now = Date.now();
    let state = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 4; i++) {
      state = recordFailure(state, now);
      expect(requiredDelayMs(state, now)).toBe(0);
    }
  });

  it("a partir del 5.º fallo la demora crece exponencialmente", () => {
    const now = Date.now();
    let state = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 5; i++) state = recordFailure(state, now);
    expect(requiredDelayMs(state, now)).toBe(2000); // 2s

    state = recordFailure(state, now);
    expect(requiredDelayMs(state, now)).toBe(4000); // 4s

    state = recordFailure(state, now);
    expect(requiredDelayMs(state, now)).toBe(8000); // 8s
  });

  it("la ventana vence a los 15 minutos", () => {
    const start = Date.now();
    let state = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 8; i++) state = recordFailure(state, start);

    const after = start + 16 * 60 * 1000;
    expect(requiredDelayMs(state, after)).toBe(0);
    // Un nuevo fallo reinicia el contador.
    const fresh = recordFailure(state, after);
    expect(fresh.count).toBe(1);
  });
});
