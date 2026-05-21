#!/usr/bin/env node
// strip-deprecated.mjs — Post-process refreshed API-docs MDX to drop
// @deprecated members that have a clear v1→v2 migration path.
//
// Per design direction (2026-05-21): rendered docs should reflect the
// current shape of the API. Items kept "absent on purpose, coming back"
// (A14 PHASE_A_EXCLUDED — slot connection / slot size / node connection
// events) are commented out in source and never appear in TypeDoc output,
// so they need no special handling here.
//
// Items with a clear migration target (e.g. v1 `setup()` → v2
// `setup() + onMounted()`, `inputs`/`outputs` getters → `getInputs()` /
// `getOutputs()`) should NOT appear with a strikethrough — the migration
// guide (`docs/extensions/migration-v1-to-v2.md`) owns those.
//
// Runs against `src/data/api-docs/*.mdx` AFTER refresh-api-docs.sh
// finishes copying the build output. This script lives in the dashboard
// repo (sole-contributor authorized per AGENTS.md Rule 9) so the upstream
// frozen `packages/extension-api/scripts/build-docs.ts` stays untouched.

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = resolve(__dirname, '..', 'src', 'data', 'api-docs')

/**
 * Detect whether a TypeDoc-rendered page describes a fully-@deprecated
 * type. TypeDoc emits a page-level `## Deprecated` heading when the
 * entire interface/type is `@deprecated`. Such pages have a 1:1
 * replacement and are dropped entirely.
 */
function isPageFullyDeprecated(raw) {
  const firstMemberSection = raw.search(
    /^## (Properties|Methods|Constructors|Accessors|Events|Type Parameters)/m
  )
  const pageDeprecated = raw.search(/^## Deprecated\b/m)
  return (
    pageDeprecated !== -1 &&
    (firstMemberSection === -1 || pageDeprecated < firstMemberSection)
  )
}

/**
 * Drop deprecated members from TypeDoc markdown output.
 *
 *   1. `### ~~name~~` — H3 method/accessor sections.
 *   2. `#### Call Signature` overload blocks containing `##### Deprecated`
 *      (handles polymorphic methods where only one overload is deprecated,
 *      e.g. `node.on('beforeSerialize', ...)` while `node.on('removed',
 *      ...)` and friends stay live).
 *   3. Markdown property-table rows whose name cell uses `~~strike~~`.
 *   4. Empty `## Methods` / `## Accessors` / `## Constructors` /
 *      `## Events` H2 sections left dangling.
 *   5. Index table rows referencing dropped pages (`| [~~Name~~](...) ...`).
 */
function stripDeprecated(body) {
  let out = body
  out = out.replace(
    /(^|\n)### ~~[^\n]+~~[\s\S]*?(?=\n### (?!~~)|\n## (?!#)|\n\*\*\*\n|$)/g,
    '$1'
  )
  out = out.replace(
    /\n#### Call Signature\n[\s\S]*?(?=\n#### Call Signature|\n### |\n## |\n\*\*\*\n|$)/g,
    (match) => (match.includes('##### Deprecated') ? '\n' : match)
  )
  out = out.replace(/^\|\s*<a id="[^"]+"><\/a>\s*~~[^\n]*\n/gm, '')
  out = out.replace(/(\n\*\*\*\n)+/g, '\n***\n')
  out = out.replace(/\n\*\*\*\n+(?=## )/g, '\n')
  out = out.replace(
    /(## (?:Methods|Accessors|Constructors|Events)\n+)\*\*\*\n+/g,
    '$1'
  )
  out = out.replace(
    /\n## (?:Methods|Accessors|Constructors|Events)\n+(?=## |$)/g,
    '\n'
  )
  // Index-table reference rows for dropped pages.
  out = out.replace(/^\|\s*\[~~[^\]]+~~\][^\n]*\n/gm, '')
  return out
}

const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.mdx'))
const dropped = []
let edited = 0

for (const f of files) {
  const path = join(DOCS_DIR, f)
  const raw = readFileSync(path, 'utf8')
  if (isPageFullyDeprecated(raw)) {
    unlinkSync(path)
    dropped.push(f.replace(/\.mdx$/, ''))
    continue
  }
  const stripped = stripDeprecated(raw)
  if (stripped !== raw) {
    writeFileSync(path, stripped)
    edited++
  }
}

console.log(
  `Stripped @deprecated members from ${edited} page(s); dropped ${dropped.length} fully-deprecated page(s)${dropped.length ? `: ${dropped.join(', ')}` : ''}.`
)
