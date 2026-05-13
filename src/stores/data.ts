import { defineStore } from "pinia";
import { computed } from "vue";

import {
  behaviorCategories,
  evidenceByPatternId,
  evidenceCountByPack,
  patternById,
  patterns,
  rollup,
  rollupByPatternId,
  starCache,
  starredPacks,
  totalEvidenceCount,
  type BehaviorCategory,
  type EvidenceRow,
  type Pattern,
  type RollupEntry,
  type StarCacheEntry,
} from "@/data";

/**
 * useDataStore — single Pinia store fronting the bundled research data.
 *
 * Mirrors the API contract from `prompts/dashboard/W2.B-data-loader.md`.
 * Pages should consume from here rather than reaching into `@/data` directly,
 * so the underlying loader can be swapped (e.g. to lazy chunks) in one place.
 */
export const useDataStore = defineStore("data", () => {
  const allPatterns = computed<Pattern[]>(() => patterns);
  const allRollup = computed<RollupEntry[]>(() => rollup);
  const allCategories = computed<BehaviorCategory[]>(() => behaviorCategories);
  const allStarredPacks = computed<StarCacheEntry[]>(() => starredPacks);
  const evidenceCount = computed<number>(() => totalEvidenceCount);

  /** Top N patterns by blast_radius (descending). */
  function topByBlastRadius(n: number): RollupEntry[] {
    return [...rollup]
      .sort((a, b) => b.blast_radius - a.blast_radius)
      .slice(0, n);
  }

  function getPattern(id: string): Pattern | undefined {
    return patternById[id] ?? patterns.find((p) => p.pattern_id === id);
  }

  function getRollup(id: string): RollupEntry | undefined {
    return rollupByPatternId[id];
  }

  function getEvidenceForPattern(id: string): EvidenceRow[] {
    return evidenceByPatternId[id] ?? [];
  }

  /**
   * Case-insensitive search across pattern_id / surface_family / surface /
   * semantic / fingerprint / v2_replacement / test_target — and across
   * every evidence row's `repo` (so a query like `rgthree` or
   * `videohelpersuite` matches every pattern that pack appears in).
   *
   * An empty / whitespace-only query returns the full pattern list.
   *
   * Note (DASH-FB-3 / DASH-FB-6): including `evidence[].repo` is what
   * fixes the user-reported "filter only hits the current page" — the
   * Patterns table's "Top pack" column was showing pack names that the
   * search couldn't match, so typing a visible value returned 0 rows
   * and looked like a scope bug. Search now matches across the full
   * dataset, including pack names.
   */
  function searchPatterns(q: string): Pattern[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return patterns;
    return patterns.filter((p) => {
      const haystack = [
        p.pattern_id,
        p.surface_family,
        p.surface,
        p.semantic,
        p.fingerprint,
        p.v2_replacement,
        p.test_target,
        ...p.evidence.map((e) => e.repo),
      ]
        .filter((s): s is string => typeof s === "string")
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  return {
    patterns: allPatterns,
    rollup: allRollup,
    behaviorCategories: allCategories,
    starredPacks: allStarredPacks,
    starCache,
    evidenceCountByPack,
    totalEvidenceCount: evidenceCount,
    topByBlastRadius,
    getPattern,
    getRollup,
    getEvidenceForPattern,
    searchPatterns,
  };
});
