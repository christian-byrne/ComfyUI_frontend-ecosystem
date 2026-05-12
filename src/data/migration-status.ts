/**
 * Per-method migration status, keyed by the v1 ComfyExtension method name.
 *
 * Sourced from the P3 migration coverage matrix
 * (`research/workspace-mirror/research/architecture/P3-migration-coverage-matrix.md`).
 *
 * The source-of-truth rollup does NOT yet carry a `migration_path` field;
 * this static map is the page's local approximation until the rollup is
 * enriched. Adding/changing entries here is a routine, low-risk edit.
 */
export type MigrationStatus =
  | 'replaced'
  | 're-implemented'
  | 'strangler-fig'
  | 'dropped'

export interface StatusEntry {
  status: MigrationStatus
  /** Optional free-form note (shown in tooltip / detail view). */
  note?: string
}

/**
 * Keys are v1 `ComfyExtension` member names. Match is case-sensitive
 * and exact; the page does a regex word-boundary search to find them
 * in the v1 source so badges only render for methods we know about.
 */
export const MIGRATION_STATUS: Record<string, StatusEntry> = {
  // Lifecycle
  init: { status: 'replaced', note: 'defineExtension({ setup })' },
  setup: { status: 'replaced', note: 'defineExtension({ setup })' },
  beforeConfigureGraph: {
    status: 'replaced',
    note: 'on("beforeConfigureGraph")'
  },
  afterConfigureGraph: {
    status: 'replaced',
    note: 'on("afterConfigureGraph")'
  },

  // Node lifecycle
  beforeRegisterNodeDef: {
    status: 're-implemented',
    note: 'defineNodeExtension({ beforeRegister })'
  },
  beforeRegisterVueAppNodeDefs: {
    status: 'dropped',
    note: 'No Vue-app-specific hook in v2'
  },
  registerCustomNodes: {
    status: 'dropped',
    note: 'D4-G2 blocker — no v2 equivalent'
  },
  loadedGraphNode: {
    status: 'replaced',
    note: 'NodeHandle.on("loaded")'
  },
  nodeCreated: {
    status: 'replaced',
    note: 'defineNodeExtension({ created })'
  },

  // Widgets
  getCustomWidgets: {
    status: 'strangler-fig',
    note: 'defineWidgetExtension (still draft)'
  },

  // Menus / commands
  getSelectionToolboxCommands: {
    status: 're-implemented',
    note: 'commands.selectionToolbox()'
  },
  getCanvasMenuItems: { status: 'replaced', note: 'menus.canvas()' },
  getNodeMenuItems: { status: 'replaced', note: 'menus.node()' },

  // Auth (deferred)
  onAuthChanged: { status: 'dropped', note: 'Out of scope for v2 surface' }
}

export function statusFor(methodName: string): StatusEntry | null {
  return MIGRATION_STATUS[methodName] ?? null
}
