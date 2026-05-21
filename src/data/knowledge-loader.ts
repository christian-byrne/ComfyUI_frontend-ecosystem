/**
 * Knowledge loader — eager-imports the design knowledge synced by
 * scripts/sync-knowledge.sh from the ECS workspace. Powers the
 * /handoff, /decisions, /axioms, /timeline, /knowledge-graph routes.
 *
 * Source of truth: the ECS workspace at
 * $HOME/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api/
 * (decisions/, AXIOMS.md, CONTEXT.md, AGENTS.md, todo.md, +
 * announcements). Re-run `pnpm sync:knowledge` to update.
 *
 * Layout in this repo:
 *   src/data/knowledge/decisions/D-*.md  — ADRs
 *   src/data/knowledge/root/AXIOMS.md    — Axiom catalog
 *   src/data/knowledge/root/CONTEXT.md   — Workspace context dump
 *   src/data/knowledge/root/AGENTS.md    — Process/workflow guide
 *   src/data/knowledge/root/todo.md      — Live wave-by-wave task board
 *   src/data/knowledge/announcements/*.md
 *   src/data/knowledge/manifest.json     — Cross-ref index (auto-built)
 */

import manifestJson from './knowledge/manifest.json'

const rawDecisions = import.meta.glob('./knowledge/decisions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const rawRoot = import.meta.glob('./knowledge/root/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const rawAnnouncements = import.meta.glob('./knowledge/announcements/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/**
 * Enriched backlink shape (Wave-18 W18.L). Attached by
 * `scripts/build-knowledge-manifest.mjs` to each decision and to every
 * entry in `axiomBacklinks`. The flat slug-only `adrBacklinks` /
 * `axiomIndex` reverse indexes are still emitted for back-compat.
 */
export interface BackLink {
  /** Source page id (decision slug or axiom id). */
  id: string
  /** Human-friendly title to render as the link text. */
  title: string
  /** Target page kind — drives routing + badge variant in the UI. */
  type: 'decision' | 'axiom'
  /**
   * Optional relation label:
   *   - `supersedes`    — the source explicitly supersedes the target
   *   - `superseded-by` — the source is explicitly superseded by the target
   *   - `mentions`     — plain body-level reference, no formal relation
   */
  relation?: 'supersedes' | 'superseded-by' | 'mentions'
}

export interface ManifestEntry {
  slug: string
  title: string
  status: string | null
  /** ISO date (`YYYY-MM-DD`) parsed out of the `**Status**:` line, when present. */
  date?: string | null
  axioms: string[]
  adrs: string[]
  waves: string[]
  /** Slugs this ADR explicitly supersedes (from `**Supersedes**:` header). */
  supersedes?: string[]
  /** Slugs that explicitly supersede this ADR (mirror of `supersedes`). */
  supersededBy?: string[]
  /**
   * Enriched "Referenced by" list (Wave-18 W18.L). Populated by the
   * builder for decisions; undefined for root/announcement entries.
   */
  backlinks?: BackLink[]
  bytes: number
  path: string
}

export interface KnowledgeManifest {
  generatedAt: string
  decisions: ManifestEntry[]
  root: ManifestEntry[]
  announcements: ManifestEntry[]
  axiomIndex: Record<string, string[]>
  adrBacklinks: Record<string, string[]>
  /**
   * Enriched axiom → "cited by" map (Wave-18 W18.L). Parallel to
   * `axiomIndex` but carries titles + types so the per-axiom card
   * "Cited by" footer in `Axioms.vue` can render without round-tripping
   * through `manifest.decisions`.
   */
  axiomBacklinks: Record<string, BackLink[]>
}

export const manifest = manifestJson as KnowledgeManifest

function buildMap(raw: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>()
  for (const [path, body] of Object.entries(raw)) {
    const slug = (path.match(/([^/]+)\.md$/)?.[1] ?? path).toLowerCase()
    m.set(slug, body)
  }
  return m
}

const decisionBodies = buildMap(rawDecisions)
const rootBodies = buildMap(rawRoot)
const announcementBodies = buildMap(rawAnnouncements)

export function getDecisionBody(slug: string): string | undefined {
  return decisionBodies.get(slug.toLowerCase())
}

export function getRootBody(slug: string): string | undefined {
  // Root files use original casing in filename (AXIOMS, CONTEXT...).
  // Map case-insensitively.
  return rootBodies.get(slug.toLowerCase())
}

export function getAnnouncementBody(slug: string): string | undefined {
  return announcementBodies.get(slug.toLowerCase())
}

/** Sorted by ADR number when possible (D1, D2, ..., D-foo last). */
export const decisionsSorted: ManifestEntry[] = [...manifest.decisions].sort((a, b) => {
  const an = a.slug.match(/^d(\d+)/)?.[1]
  const bn = b.slug.match(/^d(\d+)/)?.[1]
  if (an && bn) return Number(an) - Number(bn)
  if (an) return -1
  if (bn) return 1
  return a.slug.localeCompare(b.slug)
})

/** Group ADRs by status for the index page chip rendering. */
export const decisionsByStatus = decisionsSorted.reduce<Record<string, ManifestEntry[]>>(
  (acc, d) => {
    const status = (d.status ?? 'unknown').toLowerCase()
    acc[status] ??= []
    acc[status].push(d)
    return acc
  },
  {}
)

/** Distinct waves mentioned in any ADR — powers the timeline chip filter. */
export const allWaves: string[] = [...new Set(manifest.decisions.flatMap((d) => d.waves))].sort(
  (a, b) => {
    const an = Number.parseInt(a.replace(/[^\d]/g, ''), 10)
    const bn = Number.parseInt(b.replace(/[^\d]/g, ''), 10)
    return an - bn
  }
)

/** Distinct axioms referenced — powers /axioms chip rendering. */
export const allAxioms: string[] = Object.keys(manifest.axiomIndex).sort(
  (a, b) => Number(a.slice(1)) - Number(b.slice(1))
)
