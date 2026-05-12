/**
 * MIGRATION_STATUS — per-pattern classification under the D9 strangler-fig
 * taxonomy.
 *
 * The four buckets come from `research/workspace-mirror/decisions/D9-strangler-fig-phases.md`:
 *
 *   - `ECS-native`        — v2 dispatches through the ECS world; v1 hook
 *                           remains as a thin shim (Phase B target).
 *   - `strangler-bridge`  — v1 hook is intercepted/translated by the v2
 *                           runtime; extension code keeps working unchanged.
 *   - `unchanged-legacy`  — pattern is still served by the legacy code path;
 *                           no v2 plumbing yet.
 *   - `uwf-resolved`      — migration path is UWF Phase 3 save-time
 *                           materialization, NOT a v2 extension API. v2
 *                           bridges are transitional only.
 *
 * NOTE (N16b): the canonical source of truth for these classifications lives
 * in `research/workspace-mirror/research/architecture/P3-migration-coverage-matrix.md`
 * (markdown). Until that table is normalised into machine-readable YAML this
 * file is a hand-curated representative sample covering the highest-blast-
 * radius surfaces. Patterns absent from the map are treated as
 * `unchanged-legacy` at render time. Tracked as a follow-up; do not assume
 * coverage of every pattern_id in `touch-points-database.yaml`.
 */
import { patterns as allPatterns } from './index'
import type { Pattern } from './schema'

export const MIGRATION_STATUSES = [
  'ECS-native',
  'strangler-bridge',
  'unchanged-legacy',
  'uwf-resolved'
] as const

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number]

/**
 * Sample classification covering the highest-blast-radius patterns from the
 * P3 coverage matrix. Extend as the matrix is normalised; render layer
 * defaults missing entries to `unchanged-legacy`.
 */
export const MIGRATION_STATUS: Record<string, MigrationStatus> = {
  // S6 — App-level execution / serialization hooks
  'S6.A1': 'uwf-resolved',
  'S6.A2': 'ECS-native',
  'S6.A3': 'strangler-bridge',
  'S6.A4': 'ECS-native',
  'S6.A5': 'ECS-native',
  // S2 — Node lifecycle prototype patching
  'S2.N1': 'ECS-native',
  'S2.N15': 'ECS-native',
  'S2.N16': 'ECS-native',
  'S2.N9': 'strangler-bridge',
  'S2.N8': 'unchanged-legacy',
  // S11 — Graph mutation / batching
  'S11.G2': 'ECS-native',
  'S11.G3': 'ECS-native',
  'S11.G4': 'unchanged-legacy',
  'S11.G1': 'unchanged-legacy',
  // S7 — Globals (deprecated mirror)
  'S7.G1': 'strangler-bridge',
  // S9 — Structural entities
  'S9.SG1': 'uwf-resolved',
  // S17 — Serialization
  'S17.WV1': 'uwf-resolved',
  // S4 — Widget API
  'S4.W1': 'ECS-native',
  'S4.W2': 'ECS-native',
  'S4.W3': 'ECS-native',
  'S4.W4': 'ECS-native'
}

/**
 * One row per migration pattern: pattern metadata joined with the D9 status.
 * Consumers (e.g. the ApiDiff page) should treat this as the authoritative
 * shape for a per-pattern card.
 */
export interface MigrationEntry {
  id: string
  name: string
  /** v1 surface — the legacy fingerprint extensions monkey-patch today. */
  v1Signature: string
  /** v2 surface — the API consumers should migrate to. */
  v2Replacement: string
  status: MigrationStatus
  notes?: string
}

const DEFAULT_STATUS: MigrationStatus = 'unchanged-legacy'

function entryFromPattern(p: Pattern): MigrationEntry {
  return {
    id: p.pattern_id,
    name: p.surface,
    v1Signature: p.fingerprint ?? '— no fingerprint recorded —',
    v2Replacement: p.v2_replacement ?? '— no v2 replacement defined —',
    status: MIGRATION_STATUS[p.pattern_id] ?? DEFAULT_STATUS,
    notes: p.notes ?? p.semantic
  }
}

/**
 * All migration entries derived from the touch-points database, sorted by
 * pattern_id for stable rendering.
 */
export const migrationEntries: MigrationEntry[] = allPatterns
  .map(entryFromPattern)
  .sort((a, b) => a.id.localeCompare(b.id))
