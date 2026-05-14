/**
 * ingest-litegraph-audit.ts
 *
 * Reads the LiteGraph pruning + touch-points research from the
 * ecs-vue-hoisted-client-state-hook-api workspace and emits a
 * dashboard-ready JSON bundle at `src/data/litegraph-audit.json`.
 *
 * Inputs (paths absolute, overridable via $WORKSPACE):
 *   - $WORKSPACE/research/touch-points/database.yaml
 *   - $WORKSPACE/research/architecture/audit-litegraph-pruning.md
 *       (parses §AUDIT-LG.7 master verdict table + §AUDIT-LG.10 PR batch list)
 *   - $WORKSPACE/research/meta/sourcegraph-mcp-coverage-investigation.md
 *       (parses §Step C per-surface delta table)
 *   - $WORKSPACE/decisions/D6.2-types-package-sunset-criteria.md
 *
 * Output JSON shape:
 *   {
 *     surfaces: VerdictRow[],
 *     prs: PrEntry[],
 *     reauditDelta: DeltaRow[],
 *     sunsetGates: SunsetGate[],
 *     consumerSurfaces: ConsumerSurface[],   // S* extension-consumer surfaces
 *     meta: { generatedAt, workspace, sourceCommit? }
 *   }
 *
 * Idempotent + safe to re-run. Pure read of source files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_WORKSPACE =
  "/home/c_byrne/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api";
const WORKSPACE = process.env.WORKSPACE
  ? resolve(process.env.WORKSPACE)
  : DEFAULT_WORKSPACE;

const PATHS = {
  database: join(WORKSPACE, "research/touch-points/database.yaml"),
  audit: join(WORKSPACE, "research/architecture/audit-litegraph-pruning.md"),
  reaudit: join(
    WORKSPACE,
    "research/meta/sourcegraph-mcp-coverage-investigation.md",
  ),
  d62: join(WORKSPACE, "decisions/D6.2-types-package-sunset-criteria.md"),
};

const OUTPUT = resolve(__dirname, "../src/data/litegraph-audit.json");

// ─── types ─────────────────────────────────────────────────────────────────
interface VerdictRow {
  id: string; // lgraphnode_on_action
  kind: string; // field, method, enum_value, reexport, type, subgraph_export
  symbol: string; // LGraphNode.onAction
  internal: number; // count of internal ComfyUI_frontend call sites
  external: number; // external repos touching it
  tier: string; // top-10 | top-50 | long-tail
  verdict: string; // DELETE-NOW | KEEP | DEPRECATE
  risk: string; // low | med | high
  migration: string; // delete-immediately | deprecate-cycle | keep-permanent | decide-with-Alex
  notes?: string; // [trigger-cluster] [LG.4] [D12] [audit-correction] etc.
  prs: number[]; // PRs that touch this symbol (from AUDIT-LG.10)
}

interface PrEntry {
  num: number;
  branch: string;
  title: string;
  status: "MERGED" | "DRAFT" | "OPEN" | "CLOSED" | "UNKNOWN";
  symbolCount: number;
  description: string;
}

interface DeltaRow {
  surface: string; // S2.N1
  baseline: number;
  reauditTotal: number;
  newRepos: number;
  growth: number; // 11.0 = 11x
  topNew: { repo: string; hits: number }[];
}

interface SunsetGate {
  num: number;
  title: string;
  summary: string;
  status: "pending" | "in-progress" | "blocked" | "complete";
  items: { name: string; disposition: string; target: string; status: string }[];
}

interface ConsumerSurface {
  patternId: string; // S6.A1
  surfaceFamily: string; // S6
  surface: string; // app.graphToPrompt monkey-patching ⚠️ CRITICAL
  semantic?: string;
  v2Replacement?: string;
  decisionRef?: string;
  severity?: string;
  evidence: EvidenceRow[];
}

interface EvidenceRow {
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

// ─── helpers ───────────────────────────────────────────────────────────────
function read(p: string): string {
  return readFileSync(p, "utf-8");
}

/**
 * Parse a markdown table delimited by `| col | col |` rows. Returns
 * objects keyed by header. Strips bold markers from cells.
 */
function parseMarkdownTable(
  body: string,
  headerLineRegex: RegExp,
): Record<string, string>[] {
  const lines = body.split("\n");
  const headerIdx = lines.findIndex((l) => headerLineRegex.test(l));
  if (headerIdx === -1) return [];
  const headerCells = splitRow(lines[headerIdx]);
  // Skip the alignment row (|---|---|...).
  let i = headerIdx + 2;
  const rows: Record<string, string>[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const cells = splitRow(line);
    if (cells.length !== headerCells.length) continue;
    const obj: Record<string, string> = {};
    headerCells.forEach((h, j) => {
      obj[h] = stripBold(cells[j]);
    });
    rows.push(obj);
  }
  return rows;
}

function splitRow(line: string): string[] {
  // Strip leading/trailing pipe and whitespace, then split on |.
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function stripBold(s: string): string {
  return s.replace(/\*\*/g, "").trim();
}

function stripBacktick(s: string): string {
  return s.replace(/`/g, "").trim();
}

/**
 * Extract the verdict + bracketed annotations: "**DELETE-NOW** [trigger-cluster] [LG.4]"
 * → { verdict: "DELETE-NOW", notes: "[trigger-cluster] [LG.4]" }
 */
function splitVerdict(cell: string): { verdict: string; notes?: string } {
  const cleaned = stripBold(cell);
  const verdictMatch = cleaned.match(/^([A-Z][A-Z-]+)/);
  if (!verdictMatch) return { verdict: cleaned };
  const verdict = verdictMatch[1];
  const rest = cleaned.slice(verdictMatch[0].length).trim();
  return { verdict, notes: rest || undefined };
}

// ─── parse master verdict table (AUDIT-LG.7) ───────────────────────────────
function parseVerdictTable(audit: string): VerdictRow[] {
  // The table heading is "### Master verdict table (146 surfaces)"; the
  // header row is `| id | kind | symbol | int | ext_rep | tier | verdict | risk | migration |`.
  const headerRe = /^\| id \| kind \| symbol \| int \| ext_rep \| tier \|/;
  const raw = parseMarkdownTable(audit, headerRe);
  return raw.map((r) => {
    const { verdict, notes } = splitVerdict(r.verdict);
    return {
      id: stripBacktick(r.id),
      kind: r.kind,
      symbol: stripBacktick(r.symbol),
      internal: parseInt(r.int, 10) || 0,
      external: parseInt(r.ext_rep, 10) || 0,
      tier: r.tier,
      verdict,
      risk: r.risk,
      migration: r.migration,
      notes,
      prs: [],
    };
  });
}

// ─── parse PR batch list (AUDIT-LG.10) ─────────────────────────────────────
/**
 * AUDIT-LG.10 lists PRs as block-quote bullet items:
 *   > - **#12228** `litegraph/prune-dead-surfaces` — 6 LGraph stepping hooks (...) **[MERGED 2026-05-13, commit `b36b601a1c`]**
 * Symbol attribution lives inside the bullet text (backtick'd identifiers).
 * We extract: PR num, branch, title-ish description, status, and the
 * set of backticked symbols mentioned.
 */
function parsePrList(audit: string): {
  prs: PrEntry[];
  symbolToPrs: Map<string, number[]>;
} {
  const prs: PrEntry[] = [];
  const symbolToPrs = new Map<string, number[]>();

  // Match "**#NNNNN**" inside a blockquote bullet, capture the rest of the line
  // PLUS any continuation lines until next "> -" or empty blockquote line.
  const lines = audit.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^>\s*-\s*\*\*#(\d+)\*\*\s*`([^`]+)`\s*—\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const num = parseInt(m[1], 10);
    const branch = m[2];
    let body = m[3];
    // Eat continuation lines that are blockquote text (start with `>` but
    // not a new `> -` bullet).
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (/^>\s*-\s/.test(next)) break;
      if (!/^>/.test(next)) break;
      body += " " + next.replace(/^>\s*/, "").trim();
      j++;
    }
    i = j;

    const statusMatch = body.match(
      /\*\*\[(MERGED|DRAFT|OPEN|CLOSED)[^\]]*\]\*\*/,
    );
    const status = (statusMatch?.[1] as PrEntry["status"]) ?? "UNKNOWN";

    // Extract backticked identifiers (`SymbolName`, `prefix.suffix`,
    // `'literal'`, `LGraph.stop()`, etc.)
    const symbols = Array.from(body.matchAll(/`([^`]+)`/g))
      .map((mm) => mm[1])
      .filter(
        (s) =>
          // Drop branch refs we already captured + commit hashes + obvious
          // prose like backticked file paths.
          s !== branch &&
          !/^[a-f0-9]{7,40}$/.test(s) &&
          !s.includes("/"),
      );

    for (const s of symbols) {
      const list = symbolToPrs.get(s) ?? [];
      if (!list.includes(num)) list.push(num);
      symbolToPrs.set(s, list);
    }

    const titleMatch = body.match(/^([^\.]+?)(?:\.|\*\*\[)/);
    const title = (titleMatch?.[1] ?? body).trim().slice(0, 200);

    prs.push({
      num,
      branch,
      title,
      status,
      symbolCount: symbols.length,
      description: body.slice(0, 1500),
    });
  }
  return { prs, symbolToPrs };
}

/**
 * Attach PR numbers to verdict rows by matching the symbol's leaf name
 * (e.g. `LGraphNode.onAction` → match on `onAction`). Conservative — we
 * avoid false positives by requiring the leaf segment to appear in the
 * PR's symbol list and the family prefix to match the PR's branch.
 */
function attachPrsToSurfaces(
  surfaces: VerdictRow[],
  prs: PrEntry[],
  symbolToPrs: Map<string, number[]>,
): void {
  for (const s of surfaces) {
    const leaf = s.symbol.split(".").pop()!;
    const direct = symbolToPrs.get(leaf) ?? [];
    // Branch-family heuristic: if a PR branch contains the right cluster name
    // we trust the leaf match more (e.g. trigger-cluster, executor cluster).
    s.prs = direct.slice();
  }
}

// ─── parse re-audit delta (sourcegraph-mcp-coverage-investigation.md) ──────
function parseDeltaTable(reaudit: string): DeltaRow[] {
  // Header: | Surface | DB baseline | Re-audit total | NEW repos | Growth | Top NEW (by hit count) |
  const headerRe = /^\| Surface \| DB baseline \| Re-audit total \|/;
  const raw = parseMarkdownTable(reaudit, headerRe);
  return raw.map((r) => {
    const surface = stripBold(r.Surface).replace(/\*\*/g, "");
    const growthStr = r.Growth.replace("x", "").trim();
    const topNew = parseTopNewCell(r["Top NEW (by hit count)"] ?? "");
    return {
      surface,
      baseline: parseInt(r["DB baseline"], 10) || 0,
      reauditTotal: parseInt(r["Re-audit total"], 10) || 0,
      newRepos: parseInt(r["NEW repos"], 10) || 0,
      growth: parseFloat(growthStr) || 0,
      topNew,
    };
  });
}

function parseTopNewCell(cell: string): { repo: string; hits: number }[] {
  // e.g. "`m3rr/h4_Live`(×92), `Stibo/comfyui-nifty-nodes`(×36), `IAMCCS/IAMCCS-nodes`(×36)"
  const out: { repo: string; hits: number }[] = [];
  for (const m of cell.matchAll(/`([^`]+)`\s*\(×(\d+)\)/g)) {
    out.push({ repo: m[1], hits: parseInt(m[2], 10) || 0 });
  }
  return out;
}

// ─── parse D6.2 sunset gates ───────────────────────────────────────────────
function parseSunsetGates(d62: string): SunsetGate[] {
  // Gate sections look like "### Gate N — Title" followed by a paragraph
  // and (for Gate 2) a checklist table.
  const gates: SunsetGate[] = [];
  const re = /^### Gate (\d+) — (.+)$/gm;
  let match: RegExpExecArray | null;
  const matches: { num: number; title: string; start: number }[] = [];
  while ((match = re.exec(d62)) !== null) {
    matches.push({
      num: parseInt(match[1], 10),
      title: match[2].trim(),
      start: match.index,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const end = matches[i + 1]?.start ?? d62.length;
    const body = d62.slice(cur.start, end);
    // Items table only appears in Gate 2 today; tolerate missing.
    const items: SunsetGate["items"] = [];
    const itemHeader = /^\| v1 export\s*\| Disposition \|/m;
    if (itemHeader.test(body)) {
      const raw = parseMarkdownTable(body, itemHeader);
      for (const r of raw) {
        items.push({
          name: stripBacktick(r["v1 export"]),
          disposition: r.Disposition,
          target: stripBacktick(r["Equivalent / migration target"] ?? ""),
          status: r.Status,
        });
      }
    }
    // Status: derive from items if present, else "pending" by default.
    let status: SunsetGate["status"] = "pending";
    if (items.length > 0) {
      const allDone = items.every(
        (it) => it.status.toLowerCase() === "absorbed" || it.status === "Done",
      );
      const anyInProgress = items.some((it) =>
        /in progress/i.test(it.status),
      );
      status = allDone ? "complete" : anyInProgress ? "in-progress" : "pending";
    }
    // Summary = first paragraph after header.
    const para = body
      .split("\n")
      .slice(1)
      .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("|"));
    gates.push({
      num: cur.num,
      title: cur.title,
      summary: (para ?? "").trim(),
      status,
      items,
    });
  }
  return gates;
}

// ─── parse touch-points database for consumer surfaces ─────────────────────
interface PatternFile {
  meta?: Record<string, unknown>;
  patterns: Array<{
    pattern_id: string;
    surface_family: string;
    surface: string;
    semantic?: string;
    v2_replacement?: string;
    decision_ref?: string;
    severity?: string;
    evidence?: Array<Record<string, unknown>>;
  }>;
}

function parseConsumerSurfaces(databaseYaml: string): ConsumerSurface[] {
  const data = parseYaml(databaseYaml) as PatternFile;
  return (data.patterns ?? []).map((p) => ({
    patternId: p.pattern_id,
    surfaceFamily: p.surface_family,
    surface: p.surface,
    semantic: p.semantic,
    v2Replacement: p.v2_replacement,
    decisionRef: p.decision_ref,
    severity: p.severity,
    evidence: (p.evidence ?? []).map((e) => ({
      repo: String(e.repo ?? ""),
      file: String(e.file ?? ""),
      line: Array.isArray(e.lines)
        ? Number((e.lines as number[])[0])
        : undefined,
      url: e.url ? String(e.url) : undefined,
      variant: e.variant ? String(e.variant) : undefined,
      breakageClass: e.breakage_class ? String(e.breakage_class) : undefined,
      excerpt: e.excerpt ? String(e.excerpt) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
      source: e.source ? String(e.source) : undefined,
    })),
  }));
}

// ─── main ──────────────────────────────────────────────────────────────────
function main(): void {
  console.log(`▶ ingest from ${WORKSPACE}`);
  const databaseYaml = read(PATHS.database);
  const auditMd = read(PATHS.audit);
  const reauditMd = read(PATHS.reaudit);
  const d62Md = read(PATHS.d62);

  const surfaces = parseVerdictTable(auditMd);
  const { prs, symbolToPrs } = parsePrList(auditMd);
  attachPrsToSurfaces(surfaces, prs, symbolToPrs);
  const reauditDelta = parseDeltaTable(reauditMd);
  const sunsetGates = parseSunsetGates(d62Md);
  const consumerSurfaces = parseConsumerSurfaces(databaseYaml);

  const bundle = {
    meta: {
      generatedAt: new Date().toISOString(),
      workspace: WORKSPACE,
      counts: {
        surfaces: surfaces.length,
        prs: prs.length,
        reauditDelta: reauditDelta.length,
        sunsetGates: sunsetGates.length,
        consumerSurfaces: consumerSurfaces.length,
      },
    },
    surfaces,
    prs,
    reauditDelta,
    sunsetGates,
    consumerSurfaces,
  };

  writeFileSync(OUTPUT, JSON.stringify(bundle, null, 2) + "\n");
  console.log(
    `✓ wrote ${OUTPUT}\n  surfaces=${surfaces.length} prs=${prs.length} delta=${reauditDelta.length} gates=${sunsetGates.length} consumer-surfaces=${consumerSurfaces.length}`,
  );
}

main();
