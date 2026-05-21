import type { RouteRecordRaw } from 'vue-router'
/**
 * Regression guard for the dashboard route table — every path the rest of
 * the app links to must exist. Added in W18.B after the nav audit found that
 * BROKEN-ROUTE failures had been historically masked by SPA fallback (every
 * URL serves `index.html` and lets the client decide). Keep this list in
 * sync with `src/router/index.ts`; if you add a route there, add it here.
 */
import { describe, expect, it } from 'vitest'

import { routes } from '../router'

const expectedRoutes = [
  '/',
  '/patterns',
  '/patterns/:id',
  '/behavior-categories',
  '/behavior-categories/:id',
  '/node-packs',
  '/node-packs/:packId',
  '/heatmap',
  '/api-diff',
  '/audit',
  '/audit/surface/:id',
  '/audit/pr/:num',
  '/api-docs',
  '/api-docs/:slug',
  '/handoff',
  '/handoff/root/:slug',
  '/decisions',
  '/decisions/:slug',
  '/axioms',
  '/knowledge-graph'
]

function findRoute(rs: readonly RouteRecordRaw[], path: string): RouteRecordRaw | null {
  for (const r of rs) {
    if (r.path === path) return r
    if (r.children) {
      const c = findRoute(r.children, path)
      if (c) return c
    }
  }
  return null
}

describe('router routes', () => {
  for (const path of expectedRoutes) {
    it(`defines ${path}`, () => {
      const found = findRoute(routes, path)
      expect(found, `route ${path} not found`).toBeTruthy()
    })
  }
})
