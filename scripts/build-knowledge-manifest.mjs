#!/usr/bin/env node
// build-knowledge-manifest.mjs — Walk src/data/knowledge/ and emit a
// manifest.json with metadata + cross-references (ADR ↔ axiom ↔ wave).
// Consumed by knowledge-loader.ts and the KnowledgeGraph route.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KNOWLEDGE_DIR = resolve(__dirname, '..', 'src', 'data', 'knowledge')

/** Slug = filename without extension, lowercased. */
const slug = (f) => basename(f, '.md').toLowerCase()

/** Extract first H1 title from markdown. */
function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : null
}

/** Pull the "Status: foo" hint commonly used in ADR headers.
 *
 * Returns a normalised one-word status (`accepted`, `proposed`,
 * `superseded`, `rejected`, `deprecated`, `deferred`, `living`, `draft`,
 * `unknown`). Recognises both `**Status**:` and `**Status:**` bolding
 * conventions and the wrapping `**ACCEPTED**`/`*Accepted*` emphasis we
 * sprinkle inside the value. */
function extractStatus(body) {
  const m =
    body.match(/^\*\*Status\*\*:\s*(.+?)\s*$/m) ||
    body.match(/^\*\*Status:\*\*\s*(.+?)\s*$/m) ||
    body.match(/^>\s*Status:\s*\*?(.+?)\*?\s*$/m) ||
    body.match(/^Status:\s*(.+?)\s*$/m)
  if (!m) return 'unknown'
  // Strip leading bold/italic wrappers ("**ACCEPTED**", "*Accepted*").
  const raw = m[1].replace(/^[*_]+|[*_]+$/g, '').trim()
  const upper = raw.toUpperCase()
  // First whitespace- or em-dash-delimited token (drop the date + parenthetical).
  const token = upper.split(/[\s—–-]+/, 1)[0]
  const KNOWN = new Set([
    'ACCEPTED',
    'PROPOSED',
    'SUPERSEDED',
    'REJECTED',
    'DEPRECATED',
    'DEFERRED',
    'LIVING',
    'DRAFT'
  ])
  return KNOWN.has(token) ? token.toLowerCase() : 'unknown'
}

/** ISO date string (YYYY-MM-DD) from the Status header, if present. */
function extractStatusDate(body) {
  const m =
    body.match(/^\*\*Status\*\*:[^\n]*?(\d{4}-\d{2}-\d{2})/m) ||
    body.match(/^\*\*Status:\*\*[^\n]*?(\d{4}-\d{2}-\d{2})/m)
  return m ? m[1] : null
}

/** Best-effort `**Supersedes**: D...` / `**Superseded by**: D...` extraction.
 *
 * Matches the canonical bold-prefix line and also tolerates compound headers
 * like `**Supersedes / extends**:`. For each `D<n>` or `D-<name>` token in
 * the value, resolves to a known slug — preferring an exact match, then a
 * prefix match (so `D7 Part 4` resolves to `d7-widget-shape-and-persistence`).
 */
function extractAdrRefList(body, headerKey, knownSlugs) {
  const re = new RegExp(`^\\*\\*${headerKey}(?:\\s*/[^*]+)?\\*\\*:\\s*(.+?)\\s*$`, 'm')
  const m = body.match(re)
  if (!m) return []
  const refs = new Set()
  for (const match of m[1].matchAll(/\bD[-.0-9A-Za-z_]*\b/g)) {
    const token = match[0].toLowerCase()
    if (token === 'd') continue // bare "D" — false positive
    if (knownSlugs.has(token)) {
      refs.add(token)
      continue
    }
    // Prefix match — first known slug starting with `<token>-` or `<token>.`.
    const prefix = [...knownSlugs].find(
      (s) => s === token || s.startsWith(`${token}-`) || s.startsWith(`${token}.`)
    )
    if (prefix) refs.add(prefix)
  }
  return [...refs].sort()
}

/** All axiom IDs referenced (A1, A14, §A15, etc.). */
function extractAxiomRefs(body) {
  const ids = new Set()
  for (const m of body.matchAll(/\b(?:§?A(\d{1,2}))\b/g)) {
    const n = Number.parseInt(m[1], 10)
    if (n >= 1 && n <= 30) ids.add(`A${n}`)
  }
  return [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
}

/** All ADR IDs referenced from the body (D-foo or D14, etc.). */
function extractAdrRefs(body, selfSlug) {
  const ids = new Set()
  for (const m of body.matchAll(/\bD(?:-?[A-Za-z0-9_-]+|\d{1,3})\b/g)) {
    const ref = m[0].toLowerCase()
    if (ref === selfSlug) continue
    ids.add(ref)
  }
  return [...ids].sort()
}

/** Wave IDs (W6, W11, wave-9, etc.). */
function extractWaveRefs(body) {
  const ids = new Set()
  for (const m of body.matchAll(/\b[Ww]ave-?(\d{1,2})\b/g)) {
    ids.add(`wave-${m[1]}`)
  }
  return [...ids].sort()
}

function loadDir(subdir) {
  const dir = join(KNOWLEDGE_DIR, subdir)
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const path = join(dir, f)
      const body = readFileSync(path, 'utf8')
      const sl = slug(f)
      return {
        slug: sl,
        title: extractTitle(body) || sl,
        status: subdir === 'decisions' ? extractStatus(body) : null,
        date: subdir === 'decisions' ? extractStatusDate(body) : null,
        axioms: extractAxiomRefs(body),
        adrs: extractAdrRefs(body, sl),
        waves: extractWaveRefs(body),
        // `supersedes` / `supersededBy` are filled in a second pass below
        // (need the full slug set first).
        supersedes: [],
        supersededBy: [],
        bytes: body.length,
        path: `${subdir}/${f}`
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

const manifest = {
  generatedAt: new Date().toISOString(),
  decisions: loadDir('decisions'),
  root: loadDir('root'),
  announcements: loadDir('announcements')
}

// Second pass: extract supersedes / supersededBy now that we know which ADR
// slugs are real. Read each body again — cheap (≤ ~50 small files).
{
  const known = new Set(manifest.decisions.map((d) => d.slug))
  for (const d of manifest.decisions) {
    const body = readFileSync(join(KNOWLEDGE_DIR, d.path), 'utf8')
    d.supersedes = extractAdrRefList(body, 'Supersedes', known)
    d.supersededBy = extractAdrRefList(body, 'Superseded by', known)
  }
  // Mirror: if A.supersedes contains B but B doesn't list A in supersededBy,
  // fill B.supersededBy. Same in the other direction. Cheap O(n²) cross-link.
  for (const d of manifest.decisions) {
    for (const target of d.supersedes) {
      const other = manifest.decisions.find((x) => x.slug === target)
      if (other && !other.supersededBy.includes(d.slug)) {
        other.supersededBy.push(d.slug)
        other.supersededBy.sort()
      }
    }
    for (const target of d.supersededBy) {
      const other = manifest.decisions.find((x) => x.slug === target)
      if (other && !other.supersedes.includes(d.slug)) {
        other.supersedes.push(d.slug)
        other.supersedes.sort()
      }
    }
  }
}

// Reverse index: axiom → ADRs that reference it (powers knowledge-graph).
const axiomIndex = {}
for (const d of manifest.decisions) {
  for (const a of d.axioms) {
    axiomIndex[a] ??= []
    axiomIndex[a].push(d.slug)
  }
}
manifest.axiomIndex = axiomIndex

// Reverse index: ADR → ADRs that reference it.
const adrBacklinks = {}
for (const d of manifest.decisions) {
  for (const ref of d.adrs) {
    if (manifest.decisions.some((other) => other.slug === ref)) {
      adrBacklinks[ref] ??= []
      adrBacklinks[ref].push(d.slug)
    }
  }
}
manifest.adrBacklinks = adrBacklinks

const out = join(KNOWLEDGE_DIR, 'manifest.json')
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(
  `  ✓ manifest.json (${manifest.decisions.length} ADRs, ${Object.keys(axiomIndex).length} axioms cross-ref'd)`
)
