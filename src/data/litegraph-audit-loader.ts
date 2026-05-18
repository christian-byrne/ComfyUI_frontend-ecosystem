/**
 * Loader for the LiteGraph pruning + touch-points audit bundle generated
 * by `scripts/ingest-litegraph-audit.ts`. Pre-computes lookup indexes the
 * /audit pages depend on.
 */
import bundle from './litegraph-audit.json'

export interface VerdictRow {
  id: string
  kind: string
  symbol: string
  internal: number
  external: number
  tier: string
  verdict: string
  risk: string
  migration: string
  notes?: string
  prs: number[]
}

export interface PrEntry {
  num: number
  branch: string
  title: string
  status: 'MERGED' | 'DRAFT' | 'OPEN' | 'CLOSED' | 'UNKNOWN'
  symbolCount: number
  description: string
}

export interface DeltaRow {
  surface: string
  baseline: number
  reauditTotal: number
  newRepos: number
  growth: number
  topNew: { repo: string; hits: number }[]
}

export interface SunsetGate {
  num: number
  title: string
  summary: string
  status: 'pending' | 'in-progress' | 'blocked' | 'complete'
  items: { name: string; disposition: string; target: string; status: string }[]
}

export interface ConsumerEvidence {
  repo: string
  file: string
  line?: number
  url?: string
  variant?: string
  breakageClass?: string
  excerpt?: string
  notes?: string
  source?: string
}

export interface ConsumerSurface {
  patternId: string
  surfaceFamily: string
  surface: string
  semantic?: string
  v2Replacement?: string
  decisionRef?: string
  severity?: string
  evidence: ConsumerEvidence[]
}

export interface AuditMeta {
  generatedAt: string
  workspace: string
  counts: Record<string, number>
}

interface Bundle {
  meta: AuditMeta
  surfaces: VerdictRow[]
  prs: PrEntry[]
  reauditDelta: DeltaRow[]
  sunsetGates: SunsetGate[]
  consumerSurfaces: ConsumerSurface[]
}

const data = bundle as unknown as Bundle

export const auditMeta = data.meta
export const surfaces: VerdictRow[] = data.surfaces
export const prs: PrEntry[] = data.prs
export const reauditDelta: DeltaRow[] = data.reauditDelta
export const sunsetGates: SunsetGate[] = data.sunsetGates
export const consumerSurfaces: ConsumerSurface[] = data.consumerSurfaces

export const surfaceById: Record<string, VerdictRow> = Object.fromEntries(
  surfaces.map((s) => [s.id, s])
)
export const prByNum: Record<number, PrEntry> = Object.fromEntries(prs.map((p) => [p.num, p]))
export const consumerByPatternId: Record<string, ConsumerSurface> = Object.fromEntries(
  consumerSurfaces.map((c) => [c.patternId, c])
)
export const deltaBySurface: Record<string, DeltaRow> = Object.fromEntries(
  reauditDelta.map((d) => [d.surface, d])
)

/** Symbols affected by a given PR (back-index). */
export const surfacesByPr: Record<number, VerdictRow[]> = (() => {
  const out: Record<number, VerdictRow[]> = {}
  for (const s of surfaces) {
    for (const n of s.prs) {
      ;(out[n] = out[n] ?? []).push(s)
    }
  }
  return out
})()

/** Verdict counts for KPI cards. */
export const verdictCounts: Record<string, number> = surfaces.reduce(
  (acc, s) => {
    acc[s.verdict] = (acc[s.verdict] ?? 0) + 1
    return acc
  },
  {} as Record<string, number>
)

/** GitHub repo where the PRs live (for deep links). */
export const PR_REPO = 'Comfy-Org/ComfyUI_frontend'

/**
 * Mapping from verdict surface symbols to related consumer pattern IDs.
 * This allows the surface detail page to show consumer evidence for verdict entries.
 *
 * Pattern: verdict symbol keywords → pattern ID
 * The mapping is based on which consumer patterns access/patch the verdict symbol.
 */
const verdictToPatternMap: Record<string, string[]> = {
  // Node lifecycle callbacks
  lgraphnode_on_node_created: ['S2.N1'],
  lgraphnode_on_executed: ['S2.N2'],
  lgraphnode_on_connections_change: ['S2.N3'],
  lgraphnode_on_added: ['S2.N4'],
  lgraphnode_on_removed: ['S2.N5'],
  lgraphnode_on_serialize: ['S2.N6'],
  lgraphnode_on_configure: ['S2.N7'],
  lgraphnode_on_before_serialize: ['S2.N8'],
  lgraphnode_on_connected: ['S2.N9'],
  lgraphnode_on_connect_input: ['S2.N12'],
  lgraphnode_on_connect_output: ['S2.N13'],
  lgraphnode_on_property_changed: ['S2.N18'],
  lgraphnode_on_action: ['S2.N10', 'S2.N11'],
  // Widget patterns
  lgraphnode_add_dom_widget: ['S4.W2'],
  widget_callback: ['S4.W1'],
  // Graph events
  lgraph_on_after_execute: ['S6.A1'],
  lgraph_on_before_change: ['S6.A1'],
  // Drawing
  lgraphcanvas_draw_node: ['S3.C1']
}

/**
 * Get consumer surface by either pattern ID or verdict surface ID.
 * Falls back to searching by symbol keywords if direct lookup fails.
 */
export function getConsumerForSurface(surfaceId: string): ConsumerSurface | undefined {
  // Direct pattern ID lookup
  if (consumerByPatternId[surfaceId]) {
    return consumerByPatternId[surfaceId]
  }

  // Try verdict → pattern mapping
  const mappedPatterns = verdictToPatternMap[surfaceId]
  if (mappedPatterns?.length) {
    return consumerByPatternId[mappedPatterns[0]]
  }

  // Fuzzy match: search consumerSurfaces for matching keywords
  const verdict = surfaceById[surfaceId]
  if (verdict) {
    const symbolLower = verdict.symbol.toLowerCase()
    // Extract the method/field name (e.g., "onNodeCreated" from "LGraphNode.onNodeCreated")
    const leafName = verdict.symbol.split('.').pop()?.toLowerCase()

    for (const c of consumerSurfaces) {
      const surfaceLower = c.surface.toLowerCase()
      if ((leafName && surfaceLower.includes(leafName)) || surfaceLower.includes(symbolLower)) {
        return c
      }
    }
  }

  return undefined
}

/**
 * Get delta data by either pattern ID or verdict surface ID.
 */
export function getDeltaForSurface(surfaceId: string): DeltaRow | undefined {
  // Direct lookup
  if (deltaBySurface[surfaceId]) {
    return deltaBySurface[surfaceId]
  }

  // Try verdict → pattern mapping
  const mappedPatterns = verdictToPatternMap[surfaceId]
  if (mappedPatterns?.length) {
    for (const patternId of mappedPatterns) {
      if (deltaBySurface[patternId]) {
        return deltaBySurface[patternId]
      }
    }
  }

  return undefined
}

/**
 * Get all consumer surfaces related to a verdict surface (may be multiple patterns).
 */
export function getRelatedConsumers(surfaceId: string): ConsumerSurface[] {
  const mappedPatterns = verdictToPatternMap[surfaceId] ?? []
  const result: ConsumerSurface[] = []

  for (const patternId of mappedPatterns) {
    const consumer = consumerByPatternId[patternId]
    if (consumer) result.push(consumer)
  }

  // If no mapped patterns, try the single lookup
  if (result.length === 0) {
    const single = getConsumerForSurface(surfaceId)
    if (single) result.push(single)
  }

  return result
}
