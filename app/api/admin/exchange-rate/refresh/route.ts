import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { todayMontevideo } from "@/lib/formatting/date";

export const dynamic = "force-dynamic";

/**
 * Obtención automática de la cotización USD/UYU.
 *
 * Proveedores (credenciales SIEMPRE en el servidor):
 *  1. exchangerate.host (si EXCHANGE_RATE_API_KEY está configurada)
 *  2. open.er-api.com (sin clave) como respaldo
 *
 * Si el servicio externo no responde, el sistema sigue funcionando
 * con cotizaciones manuales: se devuelve un error claro y nada más.
 */
async function fetchRateFromProviders(): Promise<{ rate: number; source: string } | null> {
  const apiKey = serverEnv().EXCHANGE_RATE_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(
        `https://api.exchangerate.host/live?access_key=${apiKey}&source=USD&currencies=UYU`,
        { signal: AbortSignal.timeout(8000), cache: "no-store" }
      );
      if (response.ok) {
        const body = (await response.json()) as {
          success?: boolean;
          quotes?: { USDUYU?: number };
        };
        const rate = body.quotes?.USDUYU;
        if (body.success && rate && rate > 0) {
          return { rate: Math.round(rate * 10000) / 10000, source: "api:exchangerate.host" };
        }
      }
    } catch {
      // continuar con el respaldo
    }
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (response.ok) {
      const body = (await response.json()) as {
        result?: string;
        rates?: { UYU?: number };
      };
      const rate = body.rates?.UYU;
      if (body.result === "success" && rate && rate > 0) {
        return { rate: Math.round(rate * 10000) / 10000, source: "api:open-er-api" };
      }
    }
  } catch {
    // sin proveedor disponible
  }

  return null;
}

export async function POST() {
  const ctx = await requireAdminAction();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const result = await fetchRateFromProviders();
  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El servicio de cotizaciones no está disponible. Cargue la cotización manualmente; el sistema sigue funcionando.",
      },
      { status: 502 }
    );
  }

  const supabase = await createClient();
  const today = todayMontevideo();

  const { error } = await supabase.from("exchange_rates").insert({
    base_currency: "USD",
    quote_currency: "UYU",
    rate: result.rate,
    source: result.source,
    rate_date: today,
    is_manual: false,
    is_active: true,
    created_by: ctx.userId,
  });

  if (error) {
    // Índice único (fecha + fuente): ya existe la cotización de hoy de esta fuente.
    if (error.code === "23505") {
      return NextResponse.json({
        ok: true,
        rate: result.rate,
        note: "La cotización automática de hoy ya estaba registrada.",
      });
    }
    console.error("[exchange-rate] error insertando cotización", { code: error.code });
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la cotización." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, rate: result.rate, source: result.source });
}
