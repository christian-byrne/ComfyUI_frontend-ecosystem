/**
 * Wave-18 W18.D — semantic design tokens.
 *
 * Maps Tailwind v4 utility classes to *roles* (`fg-default`, `bg-elevated`,
 * `accent`, etc.) so pages stop hard-coding `zinc-500` / `blue-600` /
 * `amber-700` shades inline.
 *
 * This file is a *documentation contract*, not a runtime theme: the actual
 * styling still flows through Tailwind utilities. Import the role names
 * when you need to look up "what zinc shade is `fg-muted`?" and to keep
 * `src/design-system/system.md` and the primitives in sync.
 *
 * Source-of-truth: `research/dashboard-design-audit-2026-05-21.md`
 * (Wave-18 W18.C audit), §"Token system to extract".
 *
 * When you change a role here, also update:
 *   - `src/design-system/system.md` (Color roles table)
 *   - `src/styles/main.css` `@theme` block (semantic color tokens)
 *   - any primitive in `src/components/ui/` that hard-codes the old shade
 */

export const tokens = {
  // Spacing — 4-px grid. Matches Tailwind defaults; document the named scale.
  space: {
    xs: '0.25rem', //  4px → p-1
    sm: '0.5rem', //  8px → p-2
    md: '0.75rem', // 12px → p-3
    lg: '1rem', // 16px → p-4
    xl: '1.5rem', // 24px → p-6
    '2xl': '2rem', // 32px → p-8
    '3xl': '3rem' // 48px → p-12
  },

  // Radius — keep it tight, no pills on rectangles.
  radius: {
    sm: '0.25rem', // rounded     (chips, code)
    md: '0.375rem', // rounded-md  (default — buttons, small surfaces)
    lg: '0.5rem', // rounded-lg  (cards)
    full: '9999px' // rounded-full (avatars only)
  },

  // Color roles — each resolves to a Tailwind shade for light + dark mode.
  // Consume via Tailwind utilities (e.g. `text-zinc-500 dark:text-zinc-400`
  // for `fg-muted`) or via the corresponding `@theme` CSS variable.
  color: {
    // Surfaces
    'bg-page': { light: 'zinc-50', dark: 'zinc-950' },
    'bg-elevated': { light: 'zinc-100', dark: 'zinc-900' },
    'bg-sunken': { light: 'zinc-200', dark: 'zinc-800' },

    // Foreground
    'fg-default': { light: 'zinc-900', dark: 'zinc-100' },
    'fg-muted': { light: 'zinc-500', dark: 'zinc-400' },
    'fg-subtle': { light: 'zinc-600', dark: 'zinc-300' },

    // Borders
    border: { light: 'zinc-200', dark: 'zinc-800' },
    'border-strong': { light: 'zinc-300', dark: 'zinc-700' },

    // Accents
    accent: { light: 'blue-600', dark: 'blue-400' },
    'accent-bg': { light: 'blue-50', dark: 'blue-950' },

    // Semantic
    success: { light: 'emerald-700', dark: 'emerald-300' },
    'success-bg': { light: 'emerald-50', dark: 'emerald-900' },
    warning: { light: 'amber-700', dark: 'amber-300' },
    'warning-bg': { light: 'amber-50', dark: 'amber-900' },
    danger: { light: 'red-700', dark: 'red-300' },
    'danger-bg': { light: 'red-50', dark: 'red-900' },

    // Planned (Wave-17 carry-forward)
    planned: { light: 'violet-700', dark: 'violet-300' },
    'planned-bg': { light: 'violet-50', dark: 'violet-900' }
  },

  // Typography
  type: {
    family: {
      sans: '"Inter Tight", ui-sans-serif, system-ui, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'
    },
    scale: {
      xs: '0.75rem', // 12px — micro-labels, code chips
      sm: '0.875rem', // 14px — body
      base: '1rem', // 16px — comfortable body
      lg: '1.125rem', // 18px — H3
      xl: '1.25rem', // 20px — H2
      '2xl': '1.5rem', // 24px — H1 on detail pages
      '3xl': '1.875rem' // 30px — page H1
    },
    leading: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.7' // for <Prose>
    }
  },

  // Depth — borders-only. No shadows in the standard scale.
  depth: 'borders' as const
} as const

export type DesignTokens = typeof tokens
export type ColorRole = keyof typeof tokens.color
export type SpaceRole = keyof typeof tokens.space
export type RadiusRole = keyof typeof tokens.radius
