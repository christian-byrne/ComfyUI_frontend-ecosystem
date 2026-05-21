import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * `cn()` — shadcn-style class composition helper.
 *
 * Combines `clsx` (conditional class strings) with `tailwind-merge`
 * (deduplicates conflicting Tailwind utilities so the *last* one wins).
 * Use inside `src/components/ui/*` primitives to layer base + variant +
 * caller `class` without footguns.
 *
 * @example
 *   cn('px-2 py-1', condition && 'bg-blue-600', extraClass)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
