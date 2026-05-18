import type { EvidenceRow, RollupEntry } from '@/data/schema'
/**
 * Per-pack pattern coverage derived from the touch-points evidence.
 *
 * The Comfy Registry tells us *what* a pack is (banner, downloads, stars).
 * The local research bundle tells us *how* a pack uses the v1 API surface.
 * This composable joins the two by `repo` so the NodePacks page can sort
 * by pattern coverage / blast-radius-weighted impact, and PackDetail can
 * render a per-pattern table.
 *
 * All sources are static module-level data, so the result is memoised once
 * per process.
 */
import { evidenceCountByPack, patterns, rollupByPatternId } from '@/data'

export interface PackPatternRow {
  pattern_id: string
  surface_family: string
  name: string
  /** Number of evidence rows this pack contributes for the pattern. */
  hits: number
  blast_radius: number
  evidence: EvidenceRow[]
  rollup?: RollupEntry
}

export interface PackCoverage {
  repo: string
  /** Total evidence rows across all patterns. */
  totalHits: number
  /** Distinct pattern_ids touched by this pack. */
  patternHits: number
  /** Σ (hits × blast_radius) across patterns this pack uses. */
  weightedImpact: number
  rows: PackPatternRow[]
}

/** Build the per-pack coverage map once and memoise. */
let cache: Map<string, PackCoverage> | null = null
function buildIndex(): Map<string, PackCoverage> {
  if (cache) return cache
  const out = new Map<string, PackCoverage>()
  for (const p of patterns) {
    const rollup = rollupByPatternId[p.pattern_id]
    const blast = rollup?.blast_radius ?? 0
    for (const ev of p.evidence) {
      if (!ev.repo) continue
      let cov = out.get(ev.repo)
      if (!cov) {
        cov = {
          repo: ev.repo,
          totalHits: 0,
          patternHits: 0,
          weightedImpact: 0,
          rows: []
        }
        out.set(ev.repo, cov)
      }
      let row = cov.rows.find((r) => r.pattern_id === p.pattern_id)
      if (!row) {
        row = {
          pattern_id: p.pattern_id,
          surface_family: p.surface_family,
          name: rollup?.name ?? p.surface,
          hits: 0,
          blast_radius: blast,
          evidence: [],
          rollup
        }
        cov.rows.push(row)
        cov.patternHits++
      }
      row.hits++
      row.evidence.push({ ...ev, pattern_id: ev.pattern_id ?? p.pattern_id })
      cov.totalHits++
      cov.weightedImpact += blast
    }
  }
  for (const cov of out.values()) {
    cov.rows.sort(
      (a, b) =>
        b.blast_radius - a.blast_radius ||
        b.hits - a.hits ||
        a.pattern_id.localeCompare(b.pattern_id)
    )
  }
  cache = out
  return out
}

/** Lookup pack coverage by repo identifier (`org/repo`). */
export function getPackCoverage(repo: string): PackCoverage | undefined {
  return buildIndex().get(repo)
}

/** Top-N packs by raw evidence count (used to pick the browse list). */
export function topPacksByEvidence(n: number): string[] {
  return Object.entries(evidenceCountByPack)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([repo]) => repo)
}

/** Reset memoised data — used by tests; safe to call any time. */
export function _resetPackCoverageCache(): void {
  cache = null
}
