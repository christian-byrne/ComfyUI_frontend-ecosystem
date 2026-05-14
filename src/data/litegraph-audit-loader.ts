/**
 * Loader for the LiteGraph pruning + touch-points audit bundle generated
 * by `scripts/ingest-litegraph-audit.ts`. Pre-computes lookup indexes the
 * /audit pages depend on.
 */
import bundle from "./litegraph-audit.json";

export interface VerdictRow {
  id: string;
  kind: string;
  symbol: string;
  internal: number;
  external: number;
  tier: string;
  verdict: string;
  risk: string;
  migration: string;
  notes?: string;
  prs: number[];
}

export interface PrEntry {
  num: number;
  branch: string;
  title: string;
  status: "MERGED" | "DRAFT" | "OPEN" | "CLOSED" | "UNKNOWN";
  symbolCount: number;
  description: string;
}

export interface DeltaRow {
  surface: string;
  baseline: number;
  reauditTotal: number;
  newRepos: number;
  growth: number;
  topNew: { repo: string; hits: number }[];
}

export interface SunsetGate {
  num: number;
  title: string;
  summary: string;
  status: "pending" | "in-progress" | "blocked" | "complete";
  items: { name: string; disposition: string; target: string; status: string }[];
}

export interface ConsumerEvidence {
  repo: string;
  file: string;
  line?: number;
  url?: string;
  variant?: string;
  breakageClass?: string;
  excerpt?: string;
  notes?: string;
  source?: string;
}

export interface ConsumerSurface {
  patternId: string;
  surfaceFamily: string;
  surface: string;
  semantic?: string;
  v2Replacement?: string;
  decisionRef?: string;
  severity?: string;
  evidence: ConsumerEvidence[];
}

export interface AuditMeta {
  generatedAt: string;
  workspace: string;
  counts: Record<string, number>;
}

interface Bundle {
  meta: AuditMeta;
  surfaces: VerdictRow[];
  prs: PrEntry[];
  reauditDelta: DeltaRow[];
  sunsetGates: SunsetGate[];
  consumerSurfaces: ConsumerSurface[];
}

const data = bundle as unknown as Bundle;

export const auditMeta = data.meta;
export const surfaces: VerdictRow[] = data.surfaces;
export const prs: PrEntry[] = data.prs;
export const reauditDelta: DeltaRow[] = data.reauditDelta;
export const sunsetGates: SunsetGate[] = data.sunsetGates;
export const consumerSurfaces: ConsumerSurface[] = data.consumerSurfaces;

export const surfaceById: Record<string, VerdictRow> = Object.fromEntries(
  surfaces.map((s) => [s.id, s]),
);
export const prByNum: Record<number, PrEntry> = Object.fromEntries(
  prs.map((p) => [p.num, p]),
);
export const consumerByPatternId: Record<string, ConsumerSurface> =
  Object.fromEntries(consumerSurfaces.map((c) => [c.patternId, c]));
export const deltaBySurface: Record<string, DeltaRow> = Object.fromEntries(
  reauditDelta.map((d) => [d.surface, d]),
);

/** Symbols affected by a given PR (back-index). */
export const surfacesByPr: Record<number, VerdictRow[]> = (() => {
  const out: Record<number, VerdictRow[]> = {};
  for (const s of surfaces) {
    for (const n of s.prs) {
      (out[n] = out[n] ?? []).push(s);
    }
  }
  return out;
})();

/** Verdict counts for KPI cards. */
export const verdictCounts: Record<string, number> = surfaces.reduce(
  (acc, s) => {
    acc[s.verdict] = (acc[s.verdict] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

/** GitHub repo where the PRs live (for deep links). */
export const PR_REPO = "Comfy-Org/ComfyUI_frontend";
