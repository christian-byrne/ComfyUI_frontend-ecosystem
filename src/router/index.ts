import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

// Lazy-load pages to reduce initial bundle size. Overview is eagerly loaded
// since it's the landing page; others load on navigation.
import Overview from '../pages/Overview.vue'

const ApiDiff = () => import('../pages/ApiDiff.vue')
const BehaviorCategories = () => import('../pages/BehaviorCategories.vue')
const CategoryDetail = () => import('../pages/CategoryDetail.vue')
const Heatmap = () => import('../pages/Heatmap.vue')
const NodePacks = () => import('../pages/NodePacks.vue')
const PackDetail = () => import('../pages/PackDetail.vue')
const PatternDetail = () => import('../pages/PatternDetail.vue')
const Patterns = () => import('../pages/Patterns.vue')
const LitegraphAudit = () => import('../pages/LitegraphAudit.vue')
const AuditSurfaceDetail = () => import('../pages/AuditSurfaceDetail.vue')
const AuditPRDetail = () => import('../pages/AuditPRDetail.vue')
const ApiDocs = () => import('../pages/ApiDocs.vue')
const Handoff = () => import('../pages/Handoff.vue')
const Decisions = () => import('../pages/Decisions.vue')
const DecisionDetail = () => import('../pages/DecisionDetail.vue')
const Axioms = () => import('../pages/Axioms.vue')
const Glossary = () => import('../pages/Glossary.vue')
const KnowledgeGraph = () => import('../pages/KnowledgeGraph.vue')
const RootDoc = () => import('../pages/RootDoc.vue')
const NotFound = () => import('../pages/NotFound.vue')

/**
 * Dashboard routes. `meta.nav: true` opts a route into the App.vue header
 * navigation; detail routes (pattern/category/pack) are reached by drilling
 * down from a list page and are intentionally excluded.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'overview',
    component: Overview,
    meta: { title: 'Overview', nav: true }
  },
  {
    path: '/patterns',
    name: 'patterns',
    component: Patterns,
    meta: { title: 'Patterns', nav: true }
  },
  {
    path: '/patterns/:id',
    name: 'pattern-detail',
    component: PatternDetail,
    meta: { title: 'Pattern Detail', nav: false }
  },
  {
    path: '/behavior-categories',
    name: 'behavior-categories',
    component: BehaviorCategories,
    meta: { title: 'Behavior Categories', nav: true }
  },
  {
    path: '/behavior-categories/:id',
    name: 'category-detail',
    component: CategoryDetail,
    meta: { title: 'Category Detail', nav: false }
  },
  {
    path: '/node-packs',
    name: 'node-packs',
    component: NodePacks,
    meta: { title: 'Node Packs', nav: true }
  },
  {
    // The param name is `packId` (not `id`) so it matches what
    // `NodePackTile` and `PackDetail` already read/write. A previous
    // mismatch (`:id` here vs `params.packId` in callers) caused
    // `RouterLink` to silently drop the param, generating `/node-packs/`
    // and 404'ing — which surfaced to users as the NodePacks page being
    // unreachable / empty (DASH-FB-4).
    path: '/node-packs/:packId',
    name: 'pack-detail',
    component: PackDetail,
    meta: { title: 'Pack Detail', nav: false }
  },
  {
    path: '/heatmap',
    name: 'heatmap',
    component: Heatmap,
    meta: { title: 'Heatmap', nav: true }
  },
  {
    path: '/api-diff',
    name: 'api-diff',
    component: ApiDiff,
    meta: { title: 'API Diff', nav: true }
  },
  {
    path: '/audit',
    name: 'litegraph-audit',
    component: LitegraphAudit,
    meta: { title: 'Audit', nav: true }
  },
  {
    path: '/audit/surface/:id',
    name: 'audit-surface-detail',
    component: AuditSurfaceDetail,
    meta: { title: 'Audit Surface', nav: false }
  },
  {
    path: '/audit/pr/:num',
    name: 'audit-pr-detail',
    component: AuditPRDetail,
    meta: { title: 'Audit PR', nav: false }
  },
  {
    path: '/api-docs',
    name: 'api-docs',
    component: ApiDocs,
    meta: { title: 'API Docs', nav: true }
  },
  {
    path: '/api-docs/:slug',
    name: 'api-docs-page',
    component: ApiDocs,
    meta: { title: 'API Docs Page', nav: false }
  },
  {
    path: '/handoff',
    name: 'handoff',
    component: Handoff,
    meta: { title: 'Handoff', nav: true }
  },
  {
    path: '/handoff/root/:slug',
    name: 'handoff-root-doc',
    component: RootDoc,
    meta: { title: 'Handoff Document', nav: false }
  },
  {
    path: '/decisions',
    name: 'decisions',
    component: Decisions,
    meta: { title: 'Decisions', nav: true }
  },
  {
    path: '/decisions/:slug',
    name: 'decision-detail',
    component: DecisionDetail,
    meta: { title: 'Decision Detail', nav: false }
  },
  {
    path: '/axioms',
    name: 'axioms',
    component: Axioms,
    meta: { title: 'Axioms', nav: true }
  },
  {
    path: '/glossary',
    name: 'glossary',
    component: Glossary,
    meta: { title: 'Glossary', nav: true }
  },
  {
    path: '/knowledge-graph',
    name: 'knowledge-graph',
    component: KnowledgeGraph,
    meta: { title: 'Knowledge Graph', nav: true }
  },
  // W19.P3 — catch-all 404. Vue Router 4 requires a regex param to
  // soak up arbitrary paths; the `*` quantifier matches zero or more
  // segments so `/foo`, `/foo/bar`, and `/` (no — `/` is matched by
  // the Overview route above first, route order matters) all funnel
  // to NotFound when nothing else matches. Before this route landed,
  // the SPA silently 200'd on every unknown URL and rendered nothing.
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFound,
    meta: { title: 'Not Found', nav: false }
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // Browser back/forward — restore exact scroll position.
    if (savedPosition) return savedPosition
    // Hash navigation — scroll to the element with the matching id.
    // Offset 80px clears the sticky header (~64px) with a little breathing room.
    if (to.hash) {
      return {
        el: to.hash,
        top: 80,
        behavior: 'smooth'
      }
    }
    // Otherwise — scroll to top on route change.
    return { top: 0 }
  }
})
