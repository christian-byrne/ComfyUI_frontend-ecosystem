import type { Pattern } from './schema'

import { parse as parseYaml } from 'yaml'
import migrationCoverageYaml from '../../research/migration-coverage.yaml?raw'
import { patterns as allPatterns } from './index'

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
 * Data is derived from `research/migration-coverage.yaml` which contains the
 * canonical machine-readable classification for all patterns in the
 * touch-points-database.
 */

export const MIGRATION_STATUSES = [
  'ECS-native',
  'strangler-bridge',
  'unchanged-legacy',
  'uwf-resolved'
] as const

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number]

/**
 * YAML entry shape for a single pattern in migration-coverage.yaml.
 */
interface MigrationCoverageEntry {
  status: MigrationStatus
  v1_api: string
  v2_api: string
  notes?: string
}

/**
 * Parse the YAML and build the MIGRATION_STATUS map.
 * Validates that every pattern has a recognized status.
 */
function parseMigrationCoverage(): Record<string, MigrationStatus> {
  const data = parseYaml(migrationCoverageYaml) as Record<string, MigrationCoverageEntry>
  const result: Record<string, MigrationStatus> = {}

  for (const [patternId, entry] of Object.entries(data)) {
    if (!MIGRATION_STATUSES.includes(entry.status)) {
      console.warn(
        `[migration-status] Unknown status "${entry.status}" for pattern ${patternId}, defaulting to unchanged-legacy`
      )
      result[patternId] = 'unchanged-legacy'
    } else {
      result[patternId] = entry.status
    }
  }

  return result
}

/**
 * Per-pattern migration status derived from research/migration-coverage.yaml.
 * All patterns from the touch-points database are covered; no runtime fallback needed.
 */
export const MIGRATION_STATUS: Record<string, MigrationStatus> = parseMigrationCoverage()

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
