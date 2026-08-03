import { describe, expect, it } from "vitest";
import {
  agingBucket,
  inventoryAgeDays,
  isSlowMoving,
} from "@/services/finance/inventory";

describe("antigüedad de inventario", () => {
  it("días desde la compra hasta la fecha dada", () => {
    expect(inventoryAgeDays("2026-07-01", "2026-08-03")).toBe(33);
    expect(inventoryAgeDays("2026-08-03", "2026-08-03")).toBe(0);
  });

  it("sin fecha de compra devuelve null", () => {
    expect(inventoryAgeDays(null)).toBeNull();
  });

  it("clasifica en los grupos correctos", () => {
    expect(agingBucket(0)).toBe("0-30");
    expect(agingBucket(30)).toBe("0-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(60)).toBe("31-60");
    expect(agingBucket(61)).toBe("61-90");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(91)).toBe("91-180");
    expect(agingBucket(180)).toBe("91-180");
    expect(agingBucket(181)).toBe("180+");
    expect(agingBucket(500)).toBe("180+");
    expect(agingBucket(null)).toBeNull();
  });

  it("stock lento: más de 90 días", () => {
    expect(isSlowMoving(90)).toBe(false);
    expect(isSlowMoving(91)).toBe(true);
    expect(isSlowMoving(null)).toBe(false);
  });
});
