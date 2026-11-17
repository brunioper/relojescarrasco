import { describe, expect, it } from "vitest";
import {
  findCatalogMatches,
  normalizeReference,
  sameBrand,
  sameModel,
  type CatalogCandidate,
} from "@/lib/instagram/duplicates";
import { decideImport, usablePriceUsd, type ListingSignals } from "@/lib/instagram/decide";
import { imageUrlOf, selectNewMedia, type SourcedMedia } from "@/lib/instagram/media";
import { decryptToken, deriveTokenKey, encryptToken } from "@/lib/instagram/token-crypto";
import { listingCategory, productInputFromListing, type ListingDetection } from "@/lib/ai/listing";

const product = (overrides: Partial<CatalogCandidate>): CatalogCandidate => ({
  id: overrides.id ?? "p1",
  name: "Omega Seamaster Day Date Automatico",
  brand: "Omega",
  model: "Seamaster",
  reference_number: null,
  category: "reloj",
  status: "disponible",
  ...overrides,
});

describe("¿ya está en el catálogo?", () => {
  it("tolera errores de tipeo en la marca, pero no confunde marcas cortas", () => {
    expect(sameBrand("Citizen", "Citzen")).toBe(true);
    expect(sameBrand("TAG Heuer", "Tag Heur")).toBe(true);
    expect(sameBrand("Omega", "OMEGA")).toBe(true);
    expect(sameBrand("IWC", "IWB")).toBe(false);
    expect(sameBrand("Rolex", "Rado")).toBe(false);
  });

  it("compara modelos por palabras completas", () => {
    expect(sameModel("Seamaster", "Seamaster Day Date")).toBe(true);
    expect(sameModel("Datejust 41", "datejust 41")).toBe(true);
    expect(sameModel("Speedmaster", "Seamaster")).toBe(false);
    expect(sameModel("5", "Seiko 5")).toBe(false);
  });

  it("la referencia coincide aunque cambien puntos y espacios", () => {
    expect(normalizeReference("166.032")).toBe(normalizeReference("166 032"));
    const matches = findCatalogMatches(
      { category: "reloj", brand: "Omega", model: null, reference_number: "166032" },
      [product({ id: "a", reference_number: "166.032", brand: "Otra" })]
    );
    expect(matches).toEqual([{ productId: "a", reason: "referencia" }]);
  });

  it("marca y modelo iguales es un posible duplicado; otro modelo de la misma marca, no", () => {
    const candidates = [product({ id: "a" }), product({ id: "b", model: "Constellation", name: "Omega Constellation" })];
    expect(
      findCatalogMatches({ category: "reloj", brand: "Omega", model: "Seamaster", reference_number: null }, candidates)
    ).toEqual([{ productId: "a", reason: "modelo" }]);
    expect(
      findCatalogMatches({ category: "reloj", brand: "Omega", model: "Speedmaster", reference_number: null }, candidates)
    ).toEqual([]);
  });

  it("si no se lee el modelo, cualquier producto de esa marca es candidato", () => {
    const candidates = [product({ id: "a" }), product({ id: "b", brand: "Rolex", model: "Datejust" })];
    expect(
      findCatalogMatches({ category: "reloj", brand: "omega", model: null, reference_number: null }, candidates)
    ).toEqual([{ productId: "a", reason: "marca" }]);
  });

  it("sin modelo cargado se compara contra el nombre; ignora archivados y otra categoría", () => {
    const candidates = [
      product({ id: "a", brand: "Seiko", model: "", name: "Seiko 5 Automatic" }),
      product({ id: "b", status: "archivado" }),
      product({ id: "c", category: "accesorio", brand: "Seiko", model: "5 Automatic" }),
    ];
    expect(
      findCatalogMatches({ category: "reloj", brand: "Seiko", model: "5 Automatic", reference_number: null }, candidates)
    ).toEqual([{ productId: "a", reason: "modelo" }]);
  });
});

const signals = (overrides: Partial<ListingSignals> = {}): ListingSignals => ({
  product_type: "reloj",
  is_single_product_offer: true,
  sale_status: null,
  brand: "Omega",
  visible_price: null,
  ...overrides,
});

describe("qué se hace con cada historia", () => {
  it("descarta lo que no es un producto a la venta y lo vendido", () => {
    expect(decideImport({ signals: signals({ product_type: "desconocido" }), matches: [], autoPublish: true }).action).toBe(
      "descartar"
    );
    expect(decideImport({ signals: signals({ is_single_product_offer: false }), matches: [], autoPublish: true }).action).toBe(
      "descartar"
    );
    expect(decideImport({ signals: signals({ sale_status: "vendido" }), matches: [], autoPublish: true }).action).toBe(
      "descartar"
    );
  });

  it("si ya existe algo parecido, pide aprobación con los candidatos", () => {
    const decision = decideImport({
      signals: signals({ visible_price: { amount: 1200, currency: "USD" } }),
      matches: [{ productId: "a", reason: "modelo" }],
      autoPublish: true,
    });
    expect(decision).toMatchObject({ action: "pendiente", matches: ["a"] });
  });

  it("sin marca legible pide revisión", () => {
    expect(decideImport({ signals: signals({ brand: null }), matches: [], autoPublish: true })).toMatchObject({
      action: "pendiente",
      matches: [],
    });
  });

  it("producto nuevo con precio en dólares: se crea y se publica", () => {
    expect(
      decideImport({ signals: signals({ visible_price: { amount: 1200, currency: "USD" } }), matches: [], autoPublish: true })
    ).toMatchObject({ action: "crear", publishPriceUsd: 1200, status: "disponible" });
  });

  it("sin precio, en pesos o con la publicación automática apagada: se crea sin publicar", () => {
    for (const decision of [
      decideImport({ signals: signals(), matches: [], autoPublish: true }),
      decideImport({ signals: signals({ visible_price: { amount: 48000, currency: "UYU" } }), matches: [], autoPublish: true }),
      decideImport({ signals: signals({ visible_price: { amount: 900, currency: "USD" } }), matches: [], autoPublish: false }),
    ]) {
      expect(decision).toMatchObject({ action: "crear", publishPriceUsd: null });
    }
  });

  it("reservado se crea como reservado; precios absurdos no se usan", () => {
    expect(
      decideImport({ signals: signals({ sale_status: "reservado" }), matches: [], autoPublish: true })
    ).toMatchObject({ action: "crear", status: "reservado" });
    expect(usablePriceUsd({ amount: 5, currency: "USD" })).toBeNull();
    expect(usablePriceUsd({ amount: 2_000_000, currency: "USD" })).toBeNull();
    expect(usablePriceUsd({ amount: 1250.5, currency: "USD" })).toBe(1250.5);
  });
});

describe("historias y publicaciones de la API", () => {
  it("toma la imagen o, en los videos, la miniatura", () => {
    expect(imageUrlOf({ id: "1", media_type: "IMAGE", media_url: "https://a/img.jpg" })).toBe("https://a/img.jpg");
    expect(imageUrlOf({ id: "2", media_type: "VIDEO", media_url: "https://a/v.mp4", thumbnail_url: "https://a/t.jpg" })).toBe(
      "https://a/t.jpg"
    );
    expect(imageUrlOf({ id: "3", media_type: "VIDEO" })).toBeNull();
  });

  it("solo procesa lo nuevo desde la conexión, sin repetir, de lo más viejo a lo más nuevo", () => {
    const item = (id: string, timestamp: string, source: SourcedMedia["source"] = "historia"): SourcedMedia => ({
      id,
      media_type: "IMAGE",
      timestamp,
      source,
    });
    const selected = selectNewMedia(
      [
        item("viejo", "2026-11-01T10:00:00+0000"),
        item("b", "2026-11-17T12:00:00+0000"),
        item("a", "2026-11-17T09:00:00+0000", "publicacion"),
        item("visto", "2026-11-17T11:00:00+0000"),
        item("a", "2026-11-17T09:00:00+0000"),
      ],
      { watchSince: new Date("2026-11-16T00:00:00Z"), knownIds: new Set(["visto"]), max: 5 }
    );
    expect(selected.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("token de Instagram cifrado", () => {
  it("se recupera con la misma clave y falla con otra", () => {
    const key = deriveTokenKey("secreto-del-servidor");
    const payload = encryptToken("IGAA-token-de-prueba", key);
    expect(payload).not.toContain("IGAA");
    expect(decryptToken(payload, key)).toBe("IGAA-token-de-prueba");
    expect(() => decryptToken(payload, deriveTokenKey("otro-secreto"))).toThrow();
  });
});

const listing = (overrides: Partial<ListingDetection> = {}): ListingDetection => ({
  product_type: "reloj",
  brand: "Omega",
  model: "Seamaster",
  reference_number: "166.032",
  movement: null,
  case_material: "Acero",
  strap_material: "Cuero",
  diameter_mm: null,
  dial_color: "Plateado",
  strap_type: null,
  strap_color: null,
  strap_width_mm: null,
  strap_stitching: null,
  title: "Omega Seamaster esfera plateada",
  description: "Caja de acero con esfera plateada.",
  uncertain: [],
  is_single_product_offer: true,
  sale_status: null,
  visible_price: null,
  ...overrides,
});

describe("producto creado desde Instagram", () => {
  it("usa lo que vio la IA y deja vacío lo que completa una persona", () => {
    const input = productInputFromListing(listing(), "reloj");
    expect(input).toMatchObject({
      category: "reloj",
      name: "Omega Seamaster esfera plateada",
      brand: "Omega",
      reference_number: "166.032",
      movement: "otro",
      condition: "",
      stock_quantity: null,
      sale_mode: "consultar",
    });
  });

  it("las correas se crean como accesorio con una unidad; sin marca no se crea", () => {
    expect(listingCategory({ product_type: "correa" })).toBe("accesorio");
    expect(listingCategory({ product_type: "desconocido" })).toBeNull();
    expect(productInputFromListing(listing({ product_type: "correa" }), "accesorio")?.stock_quantity).toBe(1);
    expect(productInputFromListing(listing({ brand: null }), "reloj")).toBeNull();
  });
});
