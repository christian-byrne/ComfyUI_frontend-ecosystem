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

/** Pull the "Status: foo" hint commonly used in ADR headers. */
function extractStatus(body) {
  const m =
    body.match(/^\*\*Status:\*\*\s*(.+?)\s*$/m) ||
    body.match(/^>\s*Status:\s*\*?(.+?)\*?\s*$/m) ||
    body.match(/^Status:\s*(.+?)\s*$/m)
  return m ? m[1].trim().toLowerCase() : 'unknown'
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
        axioms: extractAxiomRefs(body),
        adrs: extractAdrRefs(body, sl),
        waves: extractWaveRefs(body),
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
