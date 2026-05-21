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
/**
 * Planned-but-not-yet-shipped v2 surfaces (W17.I).
 *
 * Each entry's `v2_api` references a symbol that is NOT exported from
 * `restack-foundation-v2/src/extension-api/index.ts` today. The /api-diff
 * page renders a <PlannedBadge variant="phase-b" …/> next to the v2 cell
 * so authors can tell at a glance which mappings are aspirational vs
 * already callable.
 *
 * Confirmed absent via grep against the Phase A frozen surface
 * (see scripts/check-axiom-compliance.sh for the canonical worktree path).
 * Cross-check by re-running the grep when extension-api/index.ts changes.
 */
const PR_11939 = 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/11939'

interface PlannedSpec {
  variant: 'phase-b' | 'ecs-pr-11939' | 'hypothetical'
  tooltip: string
  href?: string
}

export const PLANNED_PATTERNS: Record<string, PlannedSpec> = {
  'S6.A1': {
    variant: 'phase-b',
    tooltip: 'app.loadWorkflow(json) is planned; not yet exported in Phase A.',
    href: PR_11939
  },
  'S6.A4': {
    variant: 'phase-b',
    tooltip: 'graph.run({ batch }) is planned; not yet exported in Phase A.',
    href: PR_11939
  },
  'S9.RR1': {
    variant: 'phase-b',
    tooltip: 'graph.addReroute / rerouteHandle is planned; Phase A strangler only.',
    href: PR_11939
  },
  'S9.G1': {
    variant: 'phase-b',
    tooltip: 'graph.addGroup / groupHandle is planned; Phase A strangler only.',
    href: PR_11939
  },
  'S10.D1': {
    variant: 'phase-b',
    tooltip: 'nodeHandle.addInput / removeInput is Phase B (ECS dispatch).',
    href: PR_11939
  },
  'S10.D2': {
    variant: 'phase-b',
    tooltip:
      'nodeHandle.connect / disconnect is Phase B; dispatches ConnectNodes / DisconnectNodes ECS commands.',
    href: PR_11939
  },
  'S11.G2': {
    variant: 'phase-b',
    tooltip: 'graph.nodes() / graph.findNodes(...) iterators are Phase B.',
    href: PR_11939
  },
  'S11.G3': {
    variant: 'phase-b',
    tooltip: 'world.batch(...) coalesces undo/dirty/re-render in Phase B (ECS World).',
    href: PR_11939
  },
  'S12.UI1': {
    variant: 'phase-b',
    tooltip: 'app.ui.dialog.open(component, options) is the Phase B shell API.',
    href: PR_11939
  },
  'S13.SC1': {
    variant: 'phase-b',
    tooltip: 'ctx.inspectNodeDef(nodeData) + node.kind typed wrapper is Phase B.',
    href: PR_11939
  },
  'S15.O1': {
    variant: 'phase-b',
    tooltip: 'node.declareOutputs(spec) is Phase B; high lifecycle coupling.',
    href: PR_11939
  },
  'S16.DOM1': {
    variant: 'phase-b',
    tooltip:
      'extensionManager.injectStyles(css) is Phase B; scoped to extension lifetime.',
    href: PR_11939
  },
  'S16.DOM2': {
    variant: 'phase-b',
    tooltip: 'extensionManager.mountPanel(element, options) is Phase B; lifecycle-managed.',
    href: PR_11939
  },
  'S16.SB2': {
    variant: 'phase-b',
    tooltip: 'ctx.api.uploadFile(file, options) is Phase B; hides FormData + /upload/image.',
    href: PR_11939
  }
}

export interface MigrationEntry {
  id: string
  name: string
  /** v1 surface — the legacy fingerprint extensions monkey-patch today. */
  v1Signature: string
  /** v2 surface — the API consumers should migrate to. */
  v2Replacement: string
  status: MigrationStatus
  notes?: string
  /**
   * Planned-but-not-yet-shipped v2 surface (W17.I). When set, the /api-diff
   * card renders a <PlannedBadge> next to the v2 column. Derived from
   * PLANNED_PATTERNS — entries with a callable v2 surface today leave this
   * undefined.
   */
  planned?: PlannedSpec
}

const DEFAULT_STATUS: MigrationStatus = 'unchanged-legacy'

function entryFromPattern(p: Pattern): MigrationEntry {
  return {
    id: p.pattern_id,
    name: p.surface,
    v1Signature: p.fingerprint ?? '— no fingerprint recorded —',
    v2Replacement: p.v2_replacement ?? '— no v2 replacement defined —',
    status: MIGRATION_STATUS[p.pattern_id] ?? DEFAULT_STATUS,
    notes: p.notes ?? p.semantic,
    planned: PLANNED_PATTERNS[p.pattern_id]
  }
}

/**
 * All migration entries derived from the touch-points database, sorted by
 * pattern_id for stable rendering.
 */
export const migrationEntries: MigrationEntry[] = allPatterns
  .map(entryFromPattern)
  .sort((a, b) => a.id.localeCompare(b.id))
