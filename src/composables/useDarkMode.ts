/**
 * Dark mode toggle for the dashboard chrome (DASH-FB-1).
 *
 * Thin wrapper around VueUse's `useDark` so callers don't have to repeat
 * the same selector / class-name config. The composable:
 *
 *   - Toggles the `dark` class on `<html>` (matches the `@custom-variant
 *     dark` rule in `styles/main.css`).
 *   - Persists the preference to `localStorage` under
 *     `dashboard:color-scheme` so a refresh keeps the user's choice.
 *   - Falls back to the OS-level `prefers-color-scheme` on first visit.
 */
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
  storageKey: 'dashboard:color-scheme'
})

const toggleDark = useToggle(isDark)

export function useDarkMode(): {
  isDark: typeof isDark
  toggleDark: typeof toggleDark
} {
  return { isDark, toggleDark }
}
