# Dashboard Design System

> Living memory. Read this before designing anything new in
> `christian-byrne/ComfyUI_frontend-ecosystem`. Updated when patterns
> change. Source: `research/dashboard-design-audit-2026-05-21.md`
> (initial extraction, Wave-18).

## Direction

**Precision & Density.** Tight, technical, monochrome. Developer-tool
aesthetic — Linear, Raycast, GitHub. Density bias = 8/12 px padding,
4-px spacing grid, borders-only depth, mono font for data.

This dashboard serves Christian + future ecosystem maintainers reading
API docs / ADRs / behavior-pattern data. Reject: warmth,
sophistication-by-shadow, neon accents, generic card grids beyond
their natural use.

## Depth strategy

**Borders-only.** `border-zinc-200/800`. Don't add `shadow-*` — the
Wave-18 audit found only 2 shadow uses across 5.2k LOC and they should
stay that way.

## Spacing

4-px grid. Tokens: `xs=4 sm=8 md=12 lg=16 xl=24 2xl=32 3xl=48`. Use
Tailwind utilities `p-{1..12}`, `gap-{1..6}`, `space-y-{1..6}`.

## Radius

`rounded-md` (default) / `rounded-lg` (cards) / `rounded-full`
(avatars only). NEVER `rounded-2xl/3xl/full` on rectangles.

## Color roles (semantic)

| Role         | Light       | Dark        | Tailwind utility                         |
| ------------ | ----------- | ----------- | ---------------------------------------- |
| fg-default   | zinc-900    | zinc-100    | `text-zinc-900 dark:text-zinc-100`       |
| fg-muted     | zinc-500    | zinc-400    | `text-zinc-500 dark:text-zinc-400`       |
| fg-subtle    | zinc-600    | zinc-300    | `text-zinc-600 dark:text-zinc-300`       |
| bg-page      | zinc-50     | zinc-950    | `bg-zinc-50 dark:bg-zinc-950`            |
| bg-elevated  | zinc-100    | zinc-900    | `bg-zinc-100 dark:bg-zinc-900`           |
| bg-sunken    | zinc-200    | zinc-800    | `bg-zinc-200 dark:bg-zinc-800`           |
| border       | zinc-200    | zinc-800    | `border-zinc-200 dark:border-zinc-800`   |
| accent       | blue-600    | blue-400    | `text-blue-600 dark:text-blue-400`       |
| success      | emerald-700 | emerald-300 | `text-emerald-700 dark:text-emerald-300` |
| warning      | amber-700   | amber-300   | `text-amber-700 dark:text-amber-300`     |
| danger       | red-700     | red-300     | `text-red-700 dark:text-red-300`         |
| planned      | violet-700  | violet-300  | `text-violet-700 dark:text-violet-300`   |

Token source-of-truth: `src/design-system/design-tokens.ts` (TS) +
`src/styles/main.css` `@theme` block (CSS).

## Typography

- Sans (chrome): system Inter stack. Future upgrade: "Inter Tight".
- Mono (data): system mono. Future upgrade: "JetBrains Mono".
- Page H1: `text-3xl font-semibold`
- Section H2: `text-xl font-semibold`
- Body: `text-sm`
- Micro / labels / code: `text-xs font-mono`
- Prose body: use `<Prose>` (W18.F) — applies `max-w-prose` ≈ 65ch +
  vertical rhythm.

## Components

Use the primitives in `src/components/ui/`. Don't roll your own.

| Need                | Component                                                   |
| ------------------- | ----------------------------------------------------------- |
| Click action        | `<Button>`                                                  |
| Status / tag        | `<Badge>`                                                   |
| Boxed content       | `<Card>`                                                    |
| Inline code         | `<CodeChip>`                                                |
| Long-form markdown  | `<Prose>` (W18.F)                                           |
| Heading nav         | `<Toc>` (W18.F)                                             |
| Planned-surface tag | `<Badge variant="planned">` (or back-compat `<PlannedBadge>`) |

Each primitive accepts a pass-through `class` prop merged via
`@/lib/cn` (clsx + tailwind-merge) so caller utilities win over the
primitive defaults.

## Anti-patterns (caught in Wave-18 audit; do NOT re-introduce)

- `<button class="...">` inline — use `<Button>`.
- `<div class="border rounded-lg p-4">` repeated — use `<Card>`.
- `<code class="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-mono">`
  repeated — use `<CodeChip>`.
- Raw `v-html` of markdown without `<Prose>` wrapper — use
  `<Prose :html="…" />`.
- Pure black (`#000`) or pure white (`#fff`) — always `zinc-50/950`.
- `rounded-full` on a non-circular element — use `rounded-md` or
  `rounded-lg`.
- Shadows — this codebase is borders-only.
- Custom Tailwind colors per page — use the role map above.

## When to update this file

Append to the Anti-patterns table when a new AI-slop tell is caught
in code review. Append a row to Components when a new primitive
lands in `src/components/ui/`. Change the Direction section only via
ADR in `decisions/`.

— Wave-18 (2026-05-21)
