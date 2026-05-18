/**
 * useEvidenceComment — single-action "open in PR + copy comment" helper.
 *
 * GitHub has NO documented URL that auto-opens the inline-comment compose
 * modal on a specific diff line. The closest UX is:
 *   1. open the PR's "Files changed" tab (optionally deep-linked to the
 *      file+line via `#diff-<sha>R<line>`); and
 *   2. drop a pre-filled markdown comment on the user's clipboard so they
 *      can paste it into whatever inline-comment box they choose.
 *
 * This composable wraps both steps so consumers can render a single
 * button and surface a short tooltip explaining the limitation.
 */
import type { ConsumerEvidence, ConsumerSurface } from '@/data/litegraph-audit-loader'
import { PR_REPO } from '@/data/litegraph-audit-loader'

const REAUDIT_DATE = '2026-05-13'
const REAUDIT_REF = 'research/meta/sourcegraph-mcp-coverage-investigation.md §Re-audit results'

export interface CommentContext {
  /** Consumer surface (S6.A1, S2.N1, …). */
  surface: ConsumerSurface
  /** The single evidence row the reviewer is opening. */
  evidence: ConsumerEvidence
  /** Re-audit total ("now") — pulled from delta table when available. */
  reauditTotal?: number
  /** Re-audit baseline ("was") — pulled from delta table when available. */
  baseline?: number
  /** PR the comment is destined for (e.g. 12234). */
  prNum?: number
}

/**
 * Build a markdown comment matching the spec template. Keeps the body
 * deterministic so reviewers don't have to second-guess what the agent
 * dropped on their clipboard.
 */
export function buildCommentMarkdown(ctx: CommentContext): string {
  const { surface, evidence, reauditTotal, baseline } = ctx
  const counts =
    reauditTotal != null && baseline != null
      ? `this surface has ${reauditTotal} consumers across the indexed extension ecosystem (was ${baseline} pre-re-audit)`
      : `this surface has indexed consumers across the extension ecosystem`
  const consumerUrl =
    evidence.url ??
    `https://github.com/${evidence.repo}/blob/HEAD/${evidence.file}${
      evidence.line ? `#L${evidence.line}` : ''
    }`
  const severity = surface.severity ?? '—'
  const verdictLine = surface.v2Replacement ?? '(see touch-points DB for v2 target)'
  return [
    `Per touch-points audit (W2F-1 re-audit, ${REAUDIT_DATE}), ${counts}.`,
    '',
    `Severity: ${severity} | v2 replacement: \`${verdictLine}\``,
    '',
    `Affected consumer: ${consumerUrl}`,
    '',
    `Reference: ${REAUDIT_REF}`
  ].join('\n')
}

/**
 * GitHub diff anchors are derived from the SHA-256 of the *file path* used
 * in the PR diff, so we cannot construct them client-side without fetching
 * the PR. We therefore deep-link to the Files-changed tab and let the
 * reviewer scroll to the file (most reviewers have it pinned anyway).
 *
 * If a PR number is not known, we fall back to opening the PR list filtered
 * by the surface's branch convention so the reviewer can pick.
 */
export function buildPrFilesUrl(prNum?: number, file?: string): string {
  if (!prNum) return `https://github.com/${PR_REPO}/pulls`
  const base = `https://github.com/${PR_REPO}/pull/${prNum}/files`
  if (!file) return base
  // Files-changed tab supports `?file-filter=<glob>` to narrow the diff —
  // useful when a PR touches many files.
  const ext = file.split('.').pop()
  return ext ? `${base}?file-filter=*.${ext}` : base
}

export interface OpenAndCopyResult {
  ok: boolean
  copied: boolean
  /** Always populated — UI can show a "manual copy" fallback panel on `!copied`. */
  comment: string
  url: string
  error?: string
}

/**
 * Combined action: opens the PR Files-changed tab in a new window AND
 * writes the comment markdown to the clipboard.
 *
 * Notes:
 *   - Clipboard writes require a secure context (https or localhost) AND
 *     a user-gesture origin — calling this from a `@click` handler
 *     satisfies both. SSR / unit tests will hit the `!navigator.clipboard`
 *     branch and get back `copied: false`.
 *   - `window.open` may be blocked by the browser if it isn't called
 *     synchronously inside a user-gesture handler — callers should NOT
 *     `await` other work before calling this helper.
 */
export async function openInPrAndCopyComment(ctx: CommentContext): Promise<OpenAndCopyResult> {
  const comment = buildCommentMarkdown(ctx)
  const url = buildPrFilesUrl(ctx.prNum, ctx.evidence.file)

  // Open immediately so the popup-blocker treats this as user-gesture.
  let opened = true
  try {
    if (typeof window !== 'undefined') {
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      opened = win !== null
    }
  } catch {
    opened = false
  }

  let copied = false
  let error: string | undefined
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(comment)
      copied = true
    } else if (typeof document !== 'undefined') {
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement('textarea')
      ta.value = comment
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      copied = document.execCommand('copy')
      document.body.removeChild(ta)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return { ok: opened && copied, copied, comment, url, error }
}

/**
 * Deep-link to a single file at a given line on GitHub (NOT inside a PR
 * diff context). Used for the "view file" link on each evidence row.
 */
export function buildFileUrl(evidence: ConsumerEvidence): string {
  if (evidence.url) return evidence.url
  const ref = 'HEAD'
  const tail = evidence.line ? `#L${evidence.line}` : ''
  return `https://github.com/${evidence.repo}/blob/${ref}/${evidence.file}${tail}`
}
