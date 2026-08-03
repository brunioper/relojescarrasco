import { z } from "zod";
import {
  amountSchema,
  currencySchema,
  isoDateSchema,
  positiveAmountSchema,
  rateSchema,
  uuidSchema,
} from "@/lib/validation/money";

/** Esquemas Zod de todas las entidades. Se validan en cliente Y servidor. */

// ------------------------------------------------------------
// Producto
// ------------------------------------------------------------
export const movementSchema = z.enum(["automatico", "manual", "cuarzo", "solar", "otro"]);

export const productStatusSchema = z.enum([
  "disponible",
  "reservado",
  "vendido",
  "en_reparacion",
  "no_publicado",
  "archivado",
]);

const optionalTrimmed = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(200),
  brand: z.string().trim().min(1, "La marca es obligatoria.").max(100),
  model: z.string().trim().max(100).default(""),
  reference_number: optionalTrimmed,
  serial_number: optionalTrimmed,
  year_approx: z.coerce
    .number()
    .int()
    .min(1800, "Año fuera de rango.")
    .max(2100, "Año fuera de rango.")
    .nullable()
    .optional(),
  movement: movementSchema.default("automatico"),
  case_material: optionalTrimmed,
  strap_material: optionalTrimmed,
  diameter_mm: z.coerce.number().positive().max(100).nullable().optional(),
  water_resistance: optionalTrimmed,
  gender: optionalTrimmed,
  condition: z.string().trim().max(300).default(""),
  includes_box: z.coerce.boolean().default(false),
  includes_documentation: z.coerce.boolean().default(false),
  includes_accessories: optionalTrimmed,
  public_description: z.string().trim().max(5000).default(""),
  internal_notes: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  is_featured: z.coerce.boolean().default(false),
});

export type ProductInput = z.infer<typeof productSchema>;

// ------------------------------------------------------------
// Compra
// ------------------------------------------------------------
export const purchaseSchema = z.object({
  product_id: uuidSchema,
  purchase_date: isoDateSchema,
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  supplier_id: uuidSchema.nullable().optional(),
  payment_method: optionalTrimmed,
  notes: optionalTrimmed,
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

// ------------------------------------------------------------
// Costo de producto
// ------------------------------------------------------------
export const productCostSchema = z.object({
  product_id: uuidSchema,
  category_id: uuidSchema,
  description: z.string().trim().max(300).default(""),
  cost_date: isoDateSchema,
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  supplier_id: uuidSchema.nullable().optional(),
  payment_method: optionalTrimmed,
  due_date: isoDateSchema.nullable().optional(),
  notes: optionalTrimmed,
});

export type ProductCostInput = z.infer<typeof productCostSchema>;

// ------------------------------------------------------------
// Precio de lista
// ------------------------------------------------------------
export const listingPriceSchema = z.object({
  product_id: uuidSchema,
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  rate_date: isoDateSchema,
});

export type ListingPriceInput = z.infer<typeof listingPriceSchema>;

// ------------------------------------------------------------
// Venta
// ------------------------------------------------------------
export const saleExpenseItemSchema = z.object({
  category_id: uuidSchema,
  description: z.string().trim().max(300).default(""),
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
});

export const saleSchema = z.object({
  product_id: uuidSchema,
  sale_date: isoDateSchema,
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  customer_id: uuidSchema.nullable().optional(),
  payment_method: optionalTrimmed,
  amount_received: amountSchema.default(0),
  cash_account_id: uuidSchema.nullable().optional(),
  due_date: isoDateSchema.nullable().optional(),
  notes: optionalTrimmed,
  expenses: z.array(saleExpenseItemSchema).max(20).default([]),
  allow_date_before_purchase: z.coerce.boolean().default(false),
});

export type SaleInput = z.infer<typeof saleSchema>;

// ------------------------------------------------------------
// Gasto general
// ------------------------------------------------------------
export const generalExpenseSchema = z.object({
  expense_date: isoDateSchema,
  category_id: uuidSchema,
  description: z.string().trim().min(2, "La descripción es obligatoria.").max(300),
  amount: amountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  supplier_id: uuidSchema.nullable().optional(),
  payment_method: optionalTrimmed,
  due_date: isoDateSchema.nullable().optional(),
  is_recurring: z.coerce.boolean().default(false),
  notes: optionalTrimmed,
});

export type GeneralExpenseInput = z.infer<typeof generalExpenseSchema>;

// ------------------------------------------------------------
// Pago
// ------------------------------------------------------------
export const paymentTransactionTypeSchema = z.enum([
  "venta",
  "compra",
  "costo_producto",
  "gasto_general",
  "gasto_venta",
]);

export const paymentSchema = z.object({
  transaction_type: paymentTransactionTypeSchema,
  transaction_id: uuidSchema,
  payment_date: isoDateSchema,
  amount: positiveAmountSchema,
  currency: currencySchema,
  exchange_rate: rateSchema,
  payment_method: optionalTrimmed,
  cash_account_id: uuidSchema.nullable().optional(),
  notes: optionalTrimmed,
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// ------------------------------------------------------------
// Cotización
// ------------------------------------------------------------
export const exchangeRateSchema = z.object({
  rate: rateSchema,
  buy_rate: rateSchema.nullable().optional(),
  sell_rate: rateSchema.nullable().optional(),
  rate_date: isoDateSchema,
  source: z.string().trim().min(1).max(100).default("manual"),
});

export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;

// ------------------------------------------------------------
// Caja
// ------------------------------------------------------------
export const cashAccountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  currency: currencySchema,
  account_type: z.enum(["efectivo", "banco", "otro"]),
  initial_balance: amountSchema.default(0),
});

export const cashMovementSchema = z.object({
  account_id: uuidSchema,
  transaction_date: isoDateSchema,
  type: z.enum([
    "otro_ingreso",
    "aporte_dueno",
    "retiro_dueno",
    "otro_egreso",
    "ajuste_positivo",
    "ajuste_negativo",
  ]),
  amount: positiveAmountSchema,
  exchange_rate: rateSchema,
  description: z.string().trim().min(2, "La descripción es obligatoria.").max(300),
});

export const cashTransferSchema = z.object({
  from_account: uuidSchema,
  to_account: uuidSchema,
  transaction_date: isoDateSchema,
  amount_from: positiveAmountSchema,
  amount_to: positiveAmountSchema,
  exchange_rate: rateSchema,
  description: z.string().trim().max(300).default(""),
});

// ------------------------------------------------------------
// Clientes y proveedores
// ------------------------------------------------------------
export const customerSchema = z.object({
  full_name: z.string().trim().min(2, "El nombre es obligatorio.").max(200),
  phone: optionalTrimmed,
  email: z
    .string()
    .trim()
    .email("Email inválido.")
    .max(200)
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  document_id: optionalTrimmed,
  notes: optionalTrimmed,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(200),
  contact_name: optionalTrimmed,
  phone: optionalTrimmed,
  email: z
    .string()
    .trim()
    .email("Email inválido.")
    .max(200)
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: optionalTrimmed,
});

// ------------------------------------------------------------
// Configuración
// ------------------------------------------------------------
export const settingsSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  contact_email: z.string().trim().email().max(200).or(z.literal("")),
  whatsapp_number: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Número de WhatsApp en formato internacional sin + (ej: 59899123456)")
    .or(z.literal("")),
  instagram_url: z.string().trim().url().max(300).or(z.literal("")),
  address: z.string().trim().max(300),
  catalogue_intro: z.string().trim().max(2000),
  footer_text: z.string().trim().max(1000),
  privacy_text: z.string().trim().max(20000),
  terms_text: z.string().trim().max(20000),
  seo_title: z.string().trim().max(200),
  seo_description: z.string().trim().max(500),
  site_url: z.string().trim().url().max(300).or(z.literal("")),
  show_reserved_products: z.coerce.boolean(),
  show_uyu_conversion: z.coerce.boolean(),
  exchange_rate_warning_days: z.coerce.number().int().min(1).max(365),
  catalogue_rate_mode: z.enum(["latest", "fixed"]),
  catalogue_rate_value: rateSchema.nullable().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().email("Ingrese un email válido.").max(200),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(200),
  next: z
    .string()
    .regex(/^\/(?!\/)[\w\-/?=&%.]*$/, "Redirección inválida.")
    .optional(),
});

export const resetRequestSchema = z.object({
  email: z.string().trim().email("Ingrese un email válido.").max(200),
});

export const passwordUpdateSchema = z.object({
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres.")
    .max(200)
    .regex(/[A-Za-z]/, "Debe incluir letras.")
    .regex(/\d/, "Debe incluir números."),
});
