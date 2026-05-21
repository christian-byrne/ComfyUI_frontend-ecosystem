#!/usr/bin/env node
/**
 * Wave-18 W18.K — Wiki-link auto-linker.
 *
 * Scans MDX/MD content for known symbol names (API types, ADR IDs like
 * `D14`, axiom IDs like `A1`) and wraps them in `<a class="wiki-link">`
 * pointing to the canonical detail page.
 *
 * Idempotent: skips text already inside an `<a>` tag, fenced code
 * blocks, inline code, and existing markdown `[link](href)` patterns.
 * Re-running produces zero changes.
 *
 * Caps to 3 occurrences per symbol per file to avoid over-linking.
 *
 * Wired into `scripts/refresh-api-docs.sh` as a post-process after
 * stamp-planned. Run standalone via `node scripts/wiki-link-mdx.mjs`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const PER_SYMBOL_CAP = 3

/**
 * Build the symbol → href map from the live dashboard data.
 *
 * Sources:
 *  - src/data/api-docs/*.mdx     → /api-docs/<slug>     (uses frontmatter `title:`)
 *  - src/data/knowledge/decisions/*.md → /decisions/<slug>  (also matches bare `D14` ID)
 *  - Axioms A1..A20 → /axioms#<id>-refs
 */
export function buildSymbolMap(repoRoot = REPO_ROOT) {
  const map = new Map()

  // API-docs pages
  try {
    const apiDocsDir = resolve(repoRoot, 'src/data/api-docs')
    for (const f of readdirSync(apiDocsDir)) {
      if (!f.endsWith('.mdx')) continue
      const slug = basename(f, '.mdx')
      const content = readFileSync(resolve(apiDocsDir, f), 'utf8')
      const m = content.match(/^title:\s*"([^"]+)"/m)
      const title = m?.[1] ?? slug
      // Skip very short titles to avoid runaway linking (e.g. "id", "on")
      if (title.length >= 4) {
        map.set(title, `/api-docs/${slug}`)
      }
    }
  } catch {
    /* directory may be absent in fixture tests */
  }

  // ADRs
  try {
    const decisionsDir = resolve(repoRoot, 'src/data/knowledge/decisions')
    for (const f of readdirSync(decisionsDir)) {
      if (!f.endsWith('.md')) continue
      const slug = basename(f, '.md')
      map.set(slug, `/decisions/${slug}`)
      // Also match bare numeric ID (D14, D8 etc.)
      const numMatch = slug.match(/^D(\d+)/)
      if (numMatch) map.set(`D${numMatch[1]}`, `/decisions/${slug}`)
    }
  } catch {
    /* ok */
  }

  // Axioms — register A1 through A20 (current spec has A1..A16; reserve slack)
  for (let n = 1; n <= 20; n++) {
    map.set(`A${n}`, `/axioms#a${n}-refs`)
  }

  return map
}

/**
 * Split content into segments — only `text` segments are eligible for
 * auto-linking. `code`, `link`, and `frontmatter` segments pass through
 * unmodified, which is what makes the script idempotent.
 */
function splitSegments(input) {
  const segments = []
  let cursor = 0

  // 1) Front-matter (leading `---\n…\n---`)
  if (input.startsWith('---\n')) {
    const end = input.indexOf('\n---', 4)
    if (end !== -1) {
      segments.push({ type: 'frontmatter', value: input.slice(0, end + 4) })
      cursor = end + 4
    }
  }

  // 2) Tokenize the rest by code-fence / inline-code / link / anchor / text
  const remaining = input.slice(cursor)
  // Use a single combined regex with alternations. Order matters:
  // fenced > inline-code > existing <a>...</a> > markdown link > wiki-already
  const re =
    /(```[\s\S]*?```)|(`[^`\n]*`)|(<a\b[^>]*>[\s\S]*?<\/a>)|(\[[^\]\n]+\]\([^)\n]+\))/g
  let last = 0
  let m
  while ((m = re.exec(remaining)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', value: remaining.slice(last, m.index) })
    }
    segments.push({ type: 'opaque', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < remaining.length) {
    segments.push({ type: 'text', value: remaining.slice(last) })
  }

  return segments
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Auto-link known symbols within free text. Returns the modified
 * content + a count of replacements made.
 */
export function autoLink(content, symbolMap, options = {}) {
  const cap = options.cap ?? PER_SYMBOL_CAP
  const segments = splitSegments(content)
  const seen = new Map() // symbol → count already linked in this file
  let total = 0

  // Sort symbols longest-first so multi-word matches win over short ones.
  const symbols = [...symbolMap.keys()].sort((a, b) => b.length - a.length)

  // Idempotency: count pre-existing <a class="wiki-link"> spans toward
  // the per-symbol cap so re-runs don't keep linking unlinked occurrences
  // past the budget already established on a previous run.
  const wikiLinkRe = /<a\b[^>]*class="[^"]*\bwiki-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  for (const seg of segments) {
    if (seg.type !== 'opaque') continue
    for (const m of seg.value.matchAll(wikiLinkRe)) {
      const inner = m[1].trim()
      // Find which catalogued symbol matches (longest-match wins).
      for (const sym of symbols) {
        if (inner === sym) {
          seen.set(sym, (seen.get(sym) ?? 0) + 1)
          break
        }
      }
    }
  }

  for (const seg of segments) {
    if (seg.type !== 'text') continue
    let s = seg.value
    for (const sym of symbols) {
      const already = seen.get(sym) ?? 0
      if (already >= cap) continue
      const escaped = escapeRegex(sym)
      // Word-boundary on each side. Use \W (excluding underscore is fine
      // here since identifiers may include underscores in real APIs).
      const re = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, 'g')
      let local = 0
      s = s.replace(re, (_match, pre, hit) => {
        if (already + local >= cap) return pre + hit
        local++
        return `${pre}<a href="${symbolMap.get(sym)}" class="wiki-link">${hit}</a>`
      })
      if (local) {
        seen.set(sym, already + local)
        total += local
      }
    }
    seg.value = s
  }

  return { content: segments.map((s) => s.value).join(''), replacements: total }
}

// CLI entry point — guard so the file is importable by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const map = buildSymbolMap()
  const targets = [
    resolve(REPO_ROOT, 'src/data/api-docs'),
    resolve(REPO_ROOT, 'src/data/knowledge/decisions'),
  ]
  let totalReplacements = 0
  let filesTouched = 0
  for (const dir of targets) {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const f of entries) {
      if (!/\.(md|mdx)$/.test(f)) continue
      const path = resolve(dir, f)
      const original = readFileSync(path, 'utf8')
      const { content, replacements } = autoLink(original, map)
      if (content !== original) {
        writeFileSync(path, content)
        filesTouched++
        totalReplacements += replacements
      }
    }
  }
  console.log(
    `Wiki-linked ${totalReplacements} reference(s) across ${filesTouched} file(s).`
  )
}
