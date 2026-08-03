/**
 * Resultado tipado de Server Actions.
 * Los errores devueltos al cliente son SIEMPRE mensajes seguros:
 * nunca stack traces, SQL ni detalles internos.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = null>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/**
 * Convierte un error desconocido en un mensaje seguro para el usuario.
 * Los mensajes de negocio de la base (VALIDATION:, NOT_FOUND:, etc.)
 * se traducen; el resto se registra en servidor y se responde genérico.
 */
export function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const known: Array<[RegExp, (m: string) => string]> = [
    [/AUTH_REQUIRED/, () => "Su sesión expiró. Vuelva a iniciar sesión."],
    [/FORBIDDEN/, () => "No tiene permisos para realizar esta operación."],
    [/NOT_FOUND/, () => "El registro solicitado no existe."],
    [/CONFIRM_REQUIRED:?\s*(.*)/, (m) => m || "Se requiere confirmación explícita."],
    [/VALIDATION:?\s*(.*)/, (m) => m || "Los datos ingresados no son válidos."],
    [/duplicate key.*slug/i, () => "Ya existe un producto con ese slug."],
    [/duplicate key.*uq_sales_active_per_product/i, () => "El producto ya tiene una venta activa."],
    [/duplicate key.*uq_exchange_rates/i, () => "Ya existe una cotización para esa fecha y fuente."],
    [/supera el total del comprobante/, () => "El total pagado supera el total del comprobante."],
  ];

  for (const [pattern, translate] of known) {
    const match = raw.match(pattern);
    if (match) {
      const captured = match[1]?.trim() ?? "";
      const msg = translate(captured);
      if (msg) return msg;
    }
  }

  // Log estructurado en servidor, mensaje genérico al usuario.
  console.error("[action-error]", { message: raw, at: new Date().toISOString() });
  return "Ocurrió un error inesperado. Intente nuevamente.";
}
