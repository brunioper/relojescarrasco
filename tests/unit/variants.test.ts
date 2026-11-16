import { describe, expect, it } from "vitest";
import {
  compatibilityLabel,
  findDuplicateVariant,
  generateVariantCombos,
  parseList,
  parseWidths,
  readCompatibility,
  readPublicVariants,
  variantKey,
  variantLabel,
} from "@/lib/variants";
import { parseCatalogueParams } from "@/lib/catalogue-params";
import { buildInquiryMessage } from "@/lib/inquiry";

describe("etiqueta y clave de una variante", () => {
  it("arma la etiqueta con lo que esté cargado", () => {
    expect(variantLabel({ width_mm: 20, material: "Cuero", color: "Marrón" })).toBe(
      "20 mm · Cuero · Marrón"
    );
    expect(variantLabel({ width_mm: 19.5, material: null, color: " Negro " })).toBe(
      "19,5 mm · Negro"
    );
    expect(variantLabel({ width_mm: null, material: null, color: null })).toBe("Única");
  });

  it("la clave ignora mayúsculas y espacios (igual que la base)", () => {
    expect(variantKey({ width_mm: 20, material: "Cuero", color: "Negro" })).toBe(
      variantKey({ width_mm: 20, material: " cuero ", color: "NEGRO" })
    );
    expect(variantKey({ width_mm: 20, material: null, color: null })).not.toBe(
      variantKey({ width_mm: 22, material: null, color: null })
    );
  });

  it("detecta combinaciones repetidas", () => {
    expect(
      findDuplicateVariant([
        { width_mm: 20, material: "Cuero", color: "Negro" },
        { width_mm: 22, material: "Cuero", color: "Negro" },
      ])
    ).toBeNull();
    expect(
      findDuplicateVariant([
        { width_mm: 20, material: "Cuero", color: "Negro" },
        { width_mm: 20, material: "cuero", color: "negro" },
      ])
    ).toMatchObject({ width_mm: 20 });
  });
});

describe("generador de combinaciones", () => {
  it("interpreta listas escritas a mano", () => {
    expect(parseList(" Negro, Marrón ;negro\n Azul ,")).toEqual(["Negro", "Marrón", "Azul"]);
    // La coma separa valores; los medios anchos se escriben con punto (19.5).
    expect(parseWidths("22, 18mm; 20 , abc, 0, 200")).toEqual([18, 20, 22]);
    expect(parseWidths("19.5")).toEqual([19.5]);
  });

  it("crea ancho × material × color y no repite las existentes", () => {
    const existing = [{ width_mm: 20, material: "Cuero", color: "Negro" }];
    const created = generateVariantCombos(existing, {
      widths: [18, 20],
      materials: ["Cuero"],
      colors: ["Negro", "Marrón"],
    });
    expect(created).toHaveLength(3);
    expect(created.map(variantLabel)).toEqual([
      "18 mm · Cuero · Negro",
      "18 mm · Cuero · Marrón",
      "20 mm · Cuero · Marrón",
    ]);
  });

  it("funciona con una sola dimensión y no crea variantes vacías", () => {
    expect(generateVariantCombos([], { widths: [18, 20], materials: [], colors: [] })).toHaveLength(2);
    expect(generateVariantCombos([], { widths: [], materials: [], colors: [] })).toEqual([]);
  });
});

describe("lectura segura de los datos públicos", () => {
  it("variantes: descarta lo que no tenga forma válida", () => {
    expect(
      readPublicVariants([
        { id: "a", width_mm: 20, material: "Cuero", color: null, stock: 2, price_usd: 60 },
        { width_mm: 22 },
        null,
        "x",
      ])
    ).toEqual([{ id: "a", width_mm: 20, material: "Cuero", color: null, stock: 2, price_usd: 60 }]);
    expect(readPublicVariants(undefined)).toEqual([]);
    expect(readPublicVariants({})).toEqual([]);
  });

  it("compatibilidad: marca sola o marca y modelo", () => {
    const items = readCompatibility([
      { brand: "Rolex", model: null },
      { brand: "Omega", model: "Seamaster" },
      { brand: " " },
      7,
    ]);
    expect(items.map(compatibilityLabel)).toEqual(["Rolex (todos los modelos)", "Omega Seamaster"]);
    expect(readCompatibility(null)).toEqual([]);
  });
});

describe("filtros y consulta de la Etapa 2", () => {
  it("lee condición, ancho de correa y reloj compatible", () => {
    expect(
      parseCatalogueParams({ condicion: "nuevo", ancho: "20", para: "Rolex", tipo: "accesorio" })
    ).toMatchObject({ condition: "nuevo", strapWidth: 20, compatibleWith: "Rolex" });
  });

  it("descarta valores inválidos", () => {
    const filters = parseCatalogueParams({ condicion: "roto", ancho: "0" });
    expect(filters.condition).toBeUndefined();
    expect(filters.strapWidth).toBeUndefined();
    expect(parseCatalogueParams({ ancho: "999" }).strapWidth).toBeUndefined();
  });

  it("la consulta menciona la variante elegida", () => {
    const message = buildInquiryMessage(
      { brand: "Relojes Carrasco", name: "Correa de cuero clásica" },
      "https://www.relojescarrasco.com/catalogo/correa-de-cuero-clasica",
      "20 mm · Cuero · Marrón"
    );
    expect(message).toContain("Correa de cuero clásica (20 mm · Cuero · Marrón) que vi en la web");
  });
});
