import { z } from "zod";

/** Primitivas de validación monetaria compartidas. */

export const currencySchema = z.enum(["USD", "UYU"], {
  errorMap: () => ({ message: "La moneda debe ser USD o UYU." }),
});

/** Importe monetario: no negativo, máximo 2 decimales. */
export const amountSchema = z.coerce
  .number({ invalid_type_error: "Ingrese un importe válido." })
  .finite("Ingrese un importe válido.")
  .nonnegative("El importe no puede ser negativo.")
  .max(999_999_999, "Importe demasiado grande.")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "Máximo dos decimales.",
  });

/** Importe estrictamente positivo (pagos, movimientos de caja). */
export const positiveAmountSchema = amountSchema.refine((v) => v > 0, {
  message: "El importe debe ser mayor que cero.",
});

/** Cotización: estrictamente positiva, hasta 4 decimales. */
export const rateSchema = z.coerce
  .number({ invalid_type_error: "Ingrese una cotización válida." })
  .positive("La cotización debe ser mayor que cero.")
  .max(100_000, "Cotización fuera de rango.");

/** Fecha ISO (YYYY-MM-DD). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use el selector de fecha).");

export const uuidSchema = z.string().uuid("Identificador inválido.");

export const paymentStatusSchema = z.enum(["pagado", "parcial", "pendiente", "cancelado"]);
