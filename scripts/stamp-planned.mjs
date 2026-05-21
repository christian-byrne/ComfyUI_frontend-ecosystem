#!/usr/bin/env node
// stamp-planned.mjs — Stamp PlannedBadge frontmatter (`planned`,
// `plannedReason`, `plannedHref`) onto MDX pages whose source surface is
// commented out per AXIOMS.md §A14 (PHASE_A_EXCLUDED) and therefore
// describe a planned-but-not-yet-shipped API.
//
// W17.G companion to W17.H's manual override map at
// `scripts/planned-pages.json`. Runs after `strip-deprecated.mjs` in
// `refresh-api-docs.sh`; safe to run standalone.
//
// Idempotent: existing planned-* frontmatter keys are replaced rather
// than stacked. Pages absent from the override map are left untouched.
//
// Source-tag scanning (e.g. `@stability phase-b`) is intentionally
// out of scope for Wave-17 — the manual JSON map is sufficient for the
// 8 known A14 pages. A follow-up can layer source-tag scanning on top
// without breaking the override-map contract.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = resolve(__dirname, '..', 'src', 'data', 'api-docs')
const MAP_PATH = resolve(__dirname, 'planned-pages.json')

const PLANNED_KEYS = ['planned', 'plannedReason', 'plannedHref']

/**
 * Parse a YAML-ish frontmatter block (the same single-line key:value subset
 * that `src/data/api-docs-loader.ts` understands). Returns `{ meta, body,
 * raw }` where `raw` is the frontmatter source (including the `---`
 * fences) so callers can splice without re-serializing the whole page.
 */
function splitFrontmatter(raw) {
  const m = raw.match(/^(---\n([\s\S]*?)\n---\n)([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw, fenceSrc: '' }
  const meta = {}
  for (const line of m[2].split('\n')) {
    const kv =
      line.match(/^(\w+):\s*"([^"]*)"\s*$/) || line.match(/^(\w+):\s*(\S+)\s*$/)
    if (kv) meta[kv[1]] = kv[2]
  }
  return { meta, body: m[3], fenceSrc: m[1] }
}

/**
 * Serialize the metadata back to a YAML frontmatter block. Always uses
 * double-quoted values to stay compatible with the loader's regex and
 * to keep the rendered MDX safe regardless of `:` / `#` characters in
 * `plannedReason`.
 */
function serializeFrontmatter(meta) {
  const lines = Object.entries(meta).map(([k, v]) => {
    const escaped = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `${k}: "${escaped}"`
  })
  return `---\n${lines.join('\n')}\n---\n`
}

const overrides = JSON.parse(readFileSync(MAP_PATH, 'utf8'))
const existing = new Set(
  readdirSync(DOCS_DIR).filter((f) => f.endsWith('.mdx'))
)

const missing = []
let stamped = 0
let alreadyCorrect = 0

for (const [slug, spec] of Object.entries(overrides)) {
  const file = `${slug}.mdx`
  if (!existing.has(file)) {
    missing.push(slug)
    continue
  }
  const path = join(DOCS_DIR, file)
  const raw = readFileSync(path, 'utf8')
  const { meta, body, fenceSrc } = splitFrontmatter(raw)
  if (!fenceSrc) {
    console.warn(
      `[stamp-planned] ${file} has no frontmatter fence; skipping.`
    )
    continue
  }
  // Drop any prior planned-* keys so reruns don't double up.
  for (const k of PLANNED_KEYS) delete meta[k]
  meta.planned = spec.variant
  if (spec.reason) meta.plannedReason = spec.reason
  if (spec.href) meta.plannedHref = spec.href
  const next = serializeFrontmatter(meta) + body
  if (next === raw) {
    alreadyCorrect++
    continue
  }
  writeFileSync(path, next)
  stamped++
}

console.log(
  `Stamped planned-* frontmatter on ${stamped} page(s) ` +
    `(${alreadyCorrect} already correct, ${missing.length} listed in ` +
    `planned-pages.json but absent from src/data/api-docs/` +
    `${missing.length ? `: ${missing.join(', ')}` : ''}).`
)

if (missing.length > 0) {
  // Not a hard failure — the override map may legitimately reference a
  // future placeholder page that hasn't been restored yet. Emit a
  // warning so CI / sync.sh can flag drift between the two files.
  process.exitCode = 0
}
