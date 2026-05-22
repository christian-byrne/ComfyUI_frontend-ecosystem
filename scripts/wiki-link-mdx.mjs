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

  // Glossary terms (W19.A3). Each Capitalized-Term-of-Art links to
  // `/glossary#<lowercase-slug>` — heading-ids are emitted by
  // MarkdownView's slugify so they match `## Widget` → `#widget` etc.
  //
  // Cap is intentionally tighter for these (see autoLink + GLOSSARY_CAP):
  // glossary terms are generic English words (Widget, Value, Mount) and
  // would over-link if treated as ADR titles. We auto-link the FIRST
  // occurrence per file only.
  //
  // Source-of-truth: docs/glossary.md in the workspace (mirrored to
  // src/data/knowledge/root/glossary.md by scripts/sync-knowledge.sh).
  // Keep this list in sync when adding/removing glossary entries.
  for (const term of GLOSSARY_TERMS) {
    // Only register if no longer/more-specific symbol already owns the
    // exact name (e.g. WidgetHandle is an ADR target and stays so;
    // generic `Widget` falls back to the glossary).
    if (!map.has(term)) {
      map.set(term, `/glossary#${term.toLowerCase()}`)
    }
  }

  return map
}

/**
 * Canonical Capitalized Terms of Art (W19.A3). Mirrored to
 * `docs/glossary.md` in the workspace. Keep this list in lockstep
 * with the `## Term` headings in that file.
 */
export const GLOSSARY_TERMS = [
  'Widget',
  'Value',
  'Topology',
  'Schema',
  'Reference',
  'Handle',
  'Mount',
  'Recreate',
  'Remount',
  'Entity',
  'Component',
  'System',
  'World',
  'Subgraph',
  'Blueprint',
  'Promotion',
  'BoxedWidget',
  'ScopedHandle',
  'WorkflowSpec',
  'WorkflowLayout',
  'ExecutionPrompt',
  'RunSnapshot',
  'NodeHandle',
  'WidgetHandle',
  'Augmenter',
  'Disposable'
]

/**
 * Tighter cap for glossary terms — generic words would over-link at
 * the default per-symbol cap. One auto-link per file per term is
 * enough to surface the glossary affordance without polluting the body.
 */
export const GLOSSARY_CAP = 1

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
  const re = /(```[\s\S]*?```)|(`[^`\n]*`)|(<a\b[^>]*>[\s\S]*?<\/a>)|(\[[^\]\n]+\]\([^)\n]+\))/g
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
 * Count pre-existing `<a class="wiki-link">` anchors per symbol so the
 * per-file cap survives re-runs. Iterates ALL opaque segments and
 * matches each anchor's inner text against the catalogued symbols.
 */
function countExistingWikiLinks(segments, symbols, seen) {
  const wikiLinkRe = /<a\b[^>]*class="[^"]*\bwiki-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  for (const seg of segments) {
    if (seg.type !== 'opaque') continue
    for (const m of seg.value.matchAll(wikiLinkRe)) {
      const inner = m[1].trim()
      for (const sym of symbols) {
        if (inner === sym) {
          seen.set(sym, (seen.get(sym) ?? 0) + 1)
          break
        }
      }
    }
  }
}

/**
 * Auto-link known symbols within free text. Returns the modified
 * content + a count of replacements made.
 *
 * Strict idempotence (W19.P1): re-tokenize between each symbol pass so
 * newly-injected `<a>` markup becomes opaque to subsequent symbol
 * regexes in the same run. Without this re-tokenization, a longer
 * symbol like `D14-widget-state-categories` wrapped first would later
 * have the substring `D14` matched INSIDE its own injected
 * `href="/decisions/D14-..."` attribute, producing nested anchors that
 * grow on every run.
 */
export function autoLink(content, symbolMap, options = {}) {
  const cap = options.cap ?? PER_SYMBOL_CAP
  const seen = new Map() // symbol → count already linked in this file

  // Sort symbols longest-first so multi-word matches win over short ones.
  const symbols = [...symbolMap.keys()].sort((a, b) => b.length - a.length)

  let segments = splitSegments(content)
  countExistingWikiLinks(segments, symbols, seen)

  let total = 0
  for (const sym of symbols) {
    // W19.A3 — glossary terms get a tighter per-file cap (1) than
    // the default symbol cap (3) since they're generic English words
    // (Widget, Value, Mount) that appear in body prose constantly.
    // Detection is by destination URL, not by name, so a Capitalized
    // Term of Art that ALSO has a canonical API-docs/ADR target
    // (e.g. WidgetHandle, NodeHandle) keeps the default cap.
    const dest = symbolMap.get(sym) ?? ''
    const symCap = dest.startsWith('/glossary#') ? GLOSSARY_CAP : cap
    let already = seen.get(sym) ?? 0
    if (already >= symCap) continue
    const escaped = escapeRegex(sym)
    // Word-boundary on each side. Use \W (excluding underscore is fine
    // here since identifiers may include underscores in real APIs).
    const re = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, 'g')
    let touched = false
    for (const seg of segments) {
      if (seg.type !== 'text') continue
      let local = 0
      const replaced = seg.value.replace(re, (_match, pre, hit) => {
        if (already + local >= symCap) return pre + hit
        local++
        return `${pre}<a href="${symbolMap.get(sym)}" class="wiki-link">${hit}</a>`
      })
      if (local > 0) {
        seg.value = replaced
        already += local
        total += local
        touched = true
      }
    }
    if (touched) {
      // Rebuild the segment list so the just-injected `<a>` tags become
      // opaque for the next symbol pass (W19.P1 strict idempotence).
      // Reset `seen` and re-derive from the fresh tokenization — the
      // newly-injected anchors are now counted by countExistingWikiLinks.
      segments = splitSegments(segments.map((s) => s.value).join(''))
      seen.clear()
      countExistingWikiLinks(segments, symbols, seen)
    }
  }

  return { content: segments.map((s) => s.value).join(''), replacements: total }
}

// CLI entry point — guard so the file is importable by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const map = buildSymbolMap()
  const targets = [
    resolve(REPO_ROOT, 'src/data/api-docs'),
    resolve(REPO_ROOT, 'src/data/knowledge/decisions')
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
  console.log(`Wiki-linked ${totalReplacements} reference(s) across ${filesTouched} file(s).`)
}
