/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}

/**
 * Injected by `vite.config.ts` via `define`. Last-modified timestamps for the
 * source yaml files plus the build's short git SHA. Used by the Overview page
 * footnote so users can see how fresh the dashboard data is.
 */
declare const __BUILD_INFO__: {
  commitSha: string
  yaml: {
    patterns: string
    rollup: string
    starCache: string
    behaviorCategories: string
  }
}
