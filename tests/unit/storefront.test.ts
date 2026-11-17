import { describe, expect, it } from "vitest";
import { PRODUCTION_SITE_URL, resolveSiteUrl } from "@/lib/site";
import { parseCatalogueParams, priceRangeValue } from "@/lib/catalogue-params";
import {
  buildInquiryMessage,
  inquiryProductLabel,
  instagramDmUrl,
  instagramUsernameFromUrl,
} from "@/lib/inquiry";
import { buildSellWatchMessage, validateSellWatch } from "@/lib/sell-watch";

describe("URL canónica del sitio", () => {
  it("en producción ignora dominios *.vercel.app y usa el dominio propio", () => {
    expect(
      resolveSiteUrl({
        envUrl: "https://relojescarrasco.vercel.app",
        settingsUrl: null,
        vercelEnv: "production",
      })
    ).toBe(PRODUCTION_SITE_URL);
    expect(
      resolveSiteUrl({
        envUrl: "https://relojescarrasco.vercel.app",
        settingsUrl: "https://relojescarrasco.vercel.app/",
        vercelEnv: "production",
      })
    ).toBe(PRODUCTION_SITE_URL);
  });

  it("en producción respeta un dominio propio configurado", () => {
    expect(
      resolveSiteUrl({
        envUrl: "https://relojescarrasco.vercel.app",
        settingsUrl: "https://www.relojescarrasco.com/",
        vercelEnv: "production",
      })
    ).toBe("https://www.relojescarrasco.com");
    expect(
      resolveSiteUrl({ envUrl: "https://otro-dominio.uy", settingsUrl: "", vercelEnv: "production" })
    ).toBe("https://otro-dominio.uy");
  });

  it("en preview usa la URL del propio despliegue y en local, localhost", () => {
    expect(
      resolveSiteUrl({ envUrl: "https://rama-abc.vercel.app", settingsUrl: null, vercelEnv: "preview" })
    ).toBe("https://rama-abc.vercel.app");
    expect(resolveSiteUrl({ envUrl: undefined, settingsUrl: null, vercelEnv: undefined })).toBe(
      "http://localhost:3000"
    );
  });

  it("descarta valores que no son URLs", () => {
    expect(
      resolveSiteUrl({ envUrl: "no-es-una-url", settingsUrl: "tampoco", vercelEnv: "production" })
    ).toBe(PRODUCTION_SITE_URL);
  });
});

describe("filtros del catálogo desde la URL", () => {
  it("lee filtros válidos", () => {
    const filters = parseCatalogueParams({
      q: " rolex ",
      marca: "Rolex",
      movimiento: "automatico",
      material: "Acero",
      tamano: "37-39",
      min: "1000",
      max: "3000",
      caja: "1",
      papeles: "1",
      tipo: "reloj",
      orden: "price_asc",
      pagina: "2",
    });
    expect(filters).toMatchObject({
      q: "rolex",
      brand: "Rolex",
      movement: "automatico",
      material: "Acero",
      size: "37-39",
      minPrice: 1000,
      maxPrice: 3000,
      box: true,
      docs: true,
      category: "reloj",
      sort: "price_asc",
      page: 2,
    });
  });

  it("descarta valores inválidos en lugar de romper la consulta", () => {
    const filters = parseCatalogueParams({
      movimiento: "nuclear",
      tamano: "gigante",
      min: "abc",
      max: "-5",
      tipo: "auto",
      estado: "vendido",
      orden: "random",
      pagina: "-3",
      marca: ["a", "b"],
    });
    expect(filters.movement).toBeUndefined();
    expect(filters.size).toBeUndefined();
    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBeUndefined();
    expect(filters.category).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.brand).toBeUndefined();
    expect(filters.sort).toBe("newest");
    expect(filters.page).toBe(1);
  });

  it("sin parámetros devuelve los valores por defecto", () => {
    expect(parseCatalogueParams({})).toMatchObject({ sort: "newest", page: 1 });
  });

  it("reconoce los rangos de precio predefinidos", () => {
    expect(priceRangeValue(1000, 3000)).toBe("1000-3000");
    expect(priceRangeValue(undefined, 1000)).toBe("hasta-1000");
    expect(priceRangeValue(7000, undefined)).toBe("7000-mas");
    expect(priceRangeValue(1234, 5678)).toBeNull();
    expect(priceRangeValue(undefined, undefined)).toBeNull();
  });
});

describe("mensaje de consulta por un producto", () => {
  it("no repite marca ni modelo si ya están en el nombre", () => {
    expect(
      inquiryProductLabel({
        brand: "Rolex",
        name: "Rolex Datejust 36",
        model: "Datejust",
        referenceNumber: "16233",
      })
    ).toBe("Rolex Datejust 36 (ref. 16233)");
  });

  it("agrega marca y modelo cuando el nombre no los incluye", () => {
    expect(inquiryProductLabel({ brand: "Omega", name: "Reloj de buceo", model: "Seamaster" })).toBe(
      "Omega Reloj de buceo Seamaster"
    );
  });

  it("incluye el link del producto en una línea aparte", () => {
    const message = buildInquiryMessage(
      { brand: "Tudor", name: "Tudor Black Bay 58", model: "Black Bay 58" },
      "https://www.relojescarrasco.com/catalogo/tudor-black-bay-58"
    );
    expect(message).toContain("me interesa el Tudor Black Bay 58 que vi en la web");
    expect(message.split("\n")[1]).toBe(
      "https://www.relojescarrasco.com/catalogo/tudor-black-bay-58"
    );
  });

  it("interpreta la URL de perfil de Instagram", () => {
    expect(instagramUsernameFromUrl("https://www.instagram.com/relojes_carrasco/")).toBe(
      "relojes_carrasco"
    );
    expect(instagramUsernameFromUrl("https://instagram.com/relojes.carrasco?hl=es")).toBe(
      "relojes.carrasco"
    );
    expect(instagramUsernameFromUrl("https://ejemplo.com/relojes_carrasco")).toBeNull();
    expect(instagramUsernameFromUrl("")).toBeNull();
    expect(instagramDmUrl("relojes_carrasco")).toBe("https://ig.me/m/relojes_carrasco");
  });
});

describe("formulario «Vendé tu reloj»", () => {
  const base = {
    name: "Ana",
    brand: "Omega",
    model: "Seamaster",
    hasBox: true,
    hasPapers: false,
  };

  it("exige nombre, marca y modelo", () => {
    expect(validateSellWatch({ ...base, name: " " })).toMatch(/nombre/);
    expect(validateSellWatch({ ...base, brand: "" })).toMatch(/marca/);
    expect(validateSellWatch({ ...base, model: "" })).toMatch(/modelo/);
    expect(validateSellWatch(base)).toBeNull();
  });

  it("arma un mensaje ordenado y omite los campos vacíos", () => {
    const message = buildSellWatchMessage({
      ...base,
      reference: "2531.80",
      year: "",
      condition: "Muy buen estado",
      comments: "  ",
    });
    expect(message).toBe(
      [
        "Hola, soy Ana. Quiero vender un reloj:",
        "• Marca: Omega",
        "• Modelo: Seamaster",
        "• Referencia: 2531.80",
        "• Estado: Muy buen estado",
        "• Caja: sí",
        "• Papeles: no",
        "Les envío las fotos a continuación.",
      ].join("\n")
    );
  });
});
