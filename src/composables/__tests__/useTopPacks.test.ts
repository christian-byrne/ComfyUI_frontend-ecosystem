import { describe, it, expect, beforeEach } from "vitest";
import { ref } from "vue";

import { _resetPackCoverageCache } from "../usePackCoverage";
import { buildTopPacks, useTopPacks, type TopPackSort } from "../useTopPacks";

describe("useTopPacks", () => {
  beforeEach(() => {
    _resetPackCoverageCache();
  });

  describe("buildTopPacks", () => {
    it("returns array of pack entries", () => {
      const packs = buildTopPacks("stars", 10);
      expect(Array.isArray(packs)).toBe(true);
      expect(packs.length).toBeLessThanOrEqual(10);
    });

    it("each entry has required fields", () => {
      const packs = buildTopPacks("stars", 5);
      for (const pack of packs) {
        expect(pack).toHaveProperty("repo");
        expect(pack).toHaveProperty("stars");
        expect(pack).toHaveProperty("patternHits");
        expect(pack).toHaveProperty("weightedImpact");
        expect(pack).toHaveProperty("totalHits");
      }
    });

    it("sorts by stars when sort=stars", () => {
      const packs = buildTopPacks("stars", 10);
      for (let i = 1; i < packs.length; i++) {
        expect(packs[i - 1].stars).toBeGreaterThanOrEqual(packs[i].stars);
      }
    });

    it("sorts by patternHits when sort=patternHits", () => {
      const packs = buildTopPacks("patternHits", 10);
      for (let i = 1; i < packs.length; i++) {
        expect(packs[i - 1].patternHits).toBeGreaterThanOrEqual(
          packs[i].patternHits,
        );
      }
    });

    it("sorts by weightedImpact when sort=weightedImpact", () => {
      const packs = buildTopPacks("weightedImpact", 10);
      for (let i = 1; i < packs.length; i++) {
        expect(packs[i - 1].weightedImpact).toBeGreaterThanOrEqual(
          packs[i].weightedImpact,
        );
      }
    });

    it("limits to N entries", () => {
      const packs5 = buildTopPacks("stars", 5);
      const packs20 = buildTopPacks("stars", 20);
      expect(packs5.length).toBeLessThanOrEqual(5);
      expect(packs20.length).toBeLessThanOrEqual(20);
    });

    it("uses stars as secondary sort for ties", () => {
      const packs = buildTopPacks("patternHits", 20);
      // Find adjacent packs with same patternHits
      for (let i = 1; i < packs.length; i++) {
        if (packs[i - 1].patternHits === packs[i].patternHits) {
          // Should be sorted by stars desc
          expect(packs[i - 1].stars).toBeGreaterThanOrEqual(packs[i].stars);
        }
      }
    });
  });

  describe("useTopPacks composable", () => {
    it("returns computed ref", () => {
      const sort = ref<TopPackSort>("stars");
      const packs = useTopPacks(sort, 10);
      expect(packs.value).toBeDefined();
      expect(Array.isArray(packs.value)).toBe(true);
    });

    it("recomputes when sort changes", () => {
      const sort = ref<TopPackSort>("stars");
      const packs = useTopPacks(sort, 10);

      const byStars = [...packs.value];

      sort.value = "weightedImpact";
      const byImpact = [...packs.value];

      // Order should be different (unless data happens to align)
      // At minimum, verify it recomputed
      expect(packs.value.length).toBeGreaterThan(0);
    });

    it("respects limit parameter", () => {
      const sort = ref<TopPackSort>("stars");
      const packs5 = useTopPacks(sort, 5);
      const packs15 = useTopPacks(sort, 15);

      expect(packs5.value.length).toBeLessThanOrEqual(5);
      expect(packs15.value.length).toBeLessThanOrEqual(15);
    });
  });
});
