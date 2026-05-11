import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import RouteSkeleton from '../components/RouteSkeleton.vue'

/**
 * Placeholder routes for the 7 planned dashboard pages.
 *
 * Each route renders {@link RouteSkeleton} until the real page lands in W3.*.
 * To replace a placeholder: swap the `component` field for the real page
 * component and (optionally) refine `meta.title`.
 *
 * `meta.nav: true` opts a route into the App.vue header navigation.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'overview',
    component: RouteSkeleton,
    meta: { title: 'Overview', nav: true }
  },
  {
    path: '/patterns',
    name: 'patterns',
    component: RouteSkeleton,
    meta: { title: 'Patterns', nav: true }
  },
  {
    path: '/patterns/:id',
    name: 'pattern-detail',
    component: RouteSkeleton,
    meta: { title: 'Pattern Detail', nav: false }
  },
  {
    path: '/behavior-categories',
    name: 'behavior-categories',
    component: RouteSkeleton,
    meta: { title: 'Behavior Categories', nav: true }
  },
  {
    path: '/node-packs',
    name: 'node-packs',
    component: RouteSkeleton,
    meta: { title: 'Node Packs', nav: true }
  },
  {
    path: '/heatmap',
    name: 'heatmap',
    component: RouteSkeleton,
    meta: { title: 'Heatmap', nav: true }
  },
  {
    path: '/api-diff',
    name: 'api-diff',
    component: RouteSkeleton,
    meta: { title: 'API Diff', nav: true }
  },
  {
    // Storybook-style preview for NodePackCard / NodePackBanner.
    // Lazy-loaded so it never ships in the main page bundle.
    path: '/__demo/node-packs',
    name: 'demo-node-packs',
    component: () => import('../pages/NodePacksDemo.vue'),
    meta: { title: 'NodePackCard demo', nav: false }
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
