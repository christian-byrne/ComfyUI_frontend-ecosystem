import { computed, type ComputedRef } from "vue";

import {
  evidenceByPatternId,
  evidenceCountByPack,
  patterns,
  rollup,
  rollupByPatternId,
} from "@/data";
import type { EvidenceRow, Pattern, RollupEntry } from "@/data/schema";

export interface HeatmapCell {
  patternId: string;
  pack: string;
  count: number;
  evidence: EvidenceRow[];
}

export interface HeatmapMatrix {
  /** Patterns ordered by blast_radius desc (rows). */
  patterns: RollupEntry[];
  /** Top-N packs by total evidence count, ordered desc (columns). */
  packs: string[];
  /** Sparse cell map keyed by `${patternId}::${pack}`. */
  cells: Map<string, HeatmapCell>;
  /** Largest cell count in the visible matrix — denominator for the color ramp. */
  max: number;
}

export interface UseHeatmapOptions {
  /** Number of top packs to keep on the X axis. Defaults to 20 per W3 spec. */
  topPacks?: number;
}

/**
 * Build the patterns × packs heatmap matrix from the loaded research bundle.
 *
 * Pure with respect to the static module-level data sources, so the result is
 * effectively cacheable. Returned reactively (computed) for ergonomic use in
 * components — toggling `topPacks` re-derives in O(P · E_avg).
 */
export function buildHeatmapMatrix(
  source: {
    patterns: Pattern[];
    rollup: RollupEntry[];
    evidenceByPatternId: Record<string, EvidenceRow[]>;
    evidenceCountByPack: Record<string, number>;
    rollupByPatternId: Record<string, RollupEntry>;
  },
  topPacks = 20,
): HeatmapMatrix {
  const packs = Object.entries(source.evidenceCountByPack)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topPacks)
    .map(([pack]) => pack);
  const packSet = new Set(packs);

  const cells = new Map<string, HeatmapCell>();
  for (const p of source.patterns) {
    const evidence = source.evidenceByPatternId[p.pattern_id] ?? p.evidence;
    for (const ev of evidence) {
      if (!packSet.has(ev.repo)) continue;
      const key = `${p.pattern_id}::${ev.repo}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          patternId: p.pattern_id,
          pack: ev.repo,
          count: 0,
          evidence: [],
        };
        cells.set(key, cell);
      }
      cell.count++;
      cell.evidence.push(ev);
    }
  }

  // Row order: blast_radius desc, then occurrences desc, then pattern_id for stability.
  const patternsOrdered = source.patterns
    .map(
      (p): RollupEntry =>
        source.rollupByPatternId[p.pattern_id] ?? {
          pattern_id: p.pattern_id,
          surface_family: p.surface_family,
          name: p.surface,
          occurrences: p.evidence.length,
          unique_repos: new Set(p.evidence.map((e) => e.repo)).size,
          cumulative_stars: 0,
          signature_count: 0,
          silent_breakage: 0,
          lifecycle_coupling: 0,
          blast_radius: 0,
          top_repos: [],
        },
    )
    .sort(
      (a, b) =>
        b.blast_radius - a.blast_radius ||
        b.occurrences - a.occurrences ||
        a.pattern_id.localeCompare(b.pattern_id),
    );

  let max = 0;
  for (const c of cells.values()) {
    if (c.count > max) max = c.count;
  }

  return { patterns: patternsOrdered, packs, cells, max };
}

export function useHeatmap(options: UseHeatmapOptions = {}): {
  matrix: ComputedRef<HeatmapMatrix>;
  cellAt: (patternId: string, pack: string) => HeatmapCell | undefined;
  cellsByRowCol: ComputedRef<Map<string, HeatmapCell>>;
  cellKey: (patternId: string, pack: string) => string;
} {
  const matrix = computed(() =>
    buildHeatmapMatrix(
      {
        patterns,
        rollup,
        evidenceByPatternId,
        evidenceCountByPack,
        rollupByPatternId,
      },
      options.topPacks ?? 20,
    ),
  );

  function cellKey(patternId: string, pack: string): string {
    return `${patternId},${pack}`;
  }

  /**
   * Pre-computed per-`${row},${col}` cell map, derived once per matrix change.
   * Renderers should look up cells from this map instead of calling `cellAt()`
   * 6× per cell in the template (≈7k Map lookups at 59×20 otherwise).
   */
  const cellsByRowCol = computed(() => {
    const m = new Map<string, HeatmapCell>();
    for (const row of matrix.value.patterns) {
      for (const pack of matrix.value.packs) {
        const cell = matrix.value.cells.get(`${row.pattern_id}::${pack}`);
        if (cell) m.set(cellKey(row.pattern_id, pack), cell);
      }
    }
    return m;
  });

  function cellAt(patternId: string, pack: string): HeatmapCell | undefined {
    return matrix.value.cells.get(`${patternId}::${pack}`);
  }

  return { matrix, cellAt, cellsByRowCol, cellKey };
}
