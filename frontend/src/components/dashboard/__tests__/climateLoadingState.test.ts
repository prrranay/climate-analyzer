import { describe, it, expect } from "vitest";
import { CLIMATE_FACTS } from "../ClimateLoadingState";

describe("ClimateLoadingState & Climate Facts", () => {
  it("provides a rich collection of scientifically curated climate facts", () => {
    expect(CLIMATE_FACTS.length).toBeGreaterThanOrEqual(8);
  });

  it("ensures each climate fact has required metadata fields and non-empty content", () => {
    const ids = new Set<string>();

    for (const fact of CLIMATE_FACTS) {
      expect(fact.id).toBeTruthy();
      expect(fact.title).toBeTruthy();
      expect(fact.category).toBeTruthy();
      expect(fact.fact.length).toBeGreaterThan(25);

      // Verify IDs are distinct
      expect(ids.has(fact.id)).toBe(false);
      ids.add(fact.id);
    }
  });

  it("includes essential climate topics like ERA5 reanalysis and heatwave dynamics", () => {
    const categories = CLIMATE_FACTS.map((f) => f.category);
    expect(categories.some((cat) => cat.includes("ERA5"))).toBe(true);
    expect(categories.some((cat) => cat.includes("DYNAMICS") || cat.includes("RUN-LENGTH"))).toBe(true);
  });
});
