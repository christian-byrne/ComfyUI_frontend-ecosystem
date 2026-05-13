import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

import ApiDiff from "../pages/ApiDiff.vue";
import BehaviorCategories from "../pages/BehaviorCategories.vue";
import CategoryDetail from "../pages/CategoryDetail.vue";
import Heatmap from "../pages/Heatmap.vue";
import NodePacks from "../pages/NodePacks.vue";
import Overview from "../pages/Overview.vue";
import PackDetail from "../pages/PackDetail.vue";
import PatternDetail from "../pages/PatternDetail.vue";
import Patterns from "../pages/Patterns.vue";

/**
 * Dashboard routes. `meta.nav: true` opts a route into the App.vue header
 * navigation; detail routes (pattern/category/pack) are reached by drilling
 * down from a list page and are intentionally excluded.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "overview",
    component: Overview,
    meta: { title: "Overview", nav: true },
  },
  {
    path: "/patterns",
    name: "patterns",
    component: Patterns,
    meta: { title: "Patterns", nav: true },
  },
  {
    path: "/patterns/:id",
    name: "pattern-detail",
    component: PatternDetail,
    meta: { title: "Pattern Detail", nav: false },
  },
  {
    path: "/behavior-categories",
    name: "behavior-categories",
    component: BehaviorCategories,
    meta: { title: "Behavior Categories", nav: true },
  },
  {
    path: "/behavior-categories/:id",
    name: "category-detail",
    component: CategoryDetail,
    meta: { title: "Category Detail", nav: false },
  },
  {
    path: "/node-packs",
    name: "node-packs",
    component: NodePacks,
    meta: { title: "Node Packs", nav: true },
  },
  {
    // The param name is `packId` (not `id`) so it matches what
    // `NodePackTile` and `PackDetail` already read/write. A previous
    // mismatch (`:id` here vs `params.packId` in callers) caused
    // `RouterLink` to silently drop the param, generating `/node-packs/`
    // and 404'ing — which surfaced to users as the NodePacks page being
    // unreachable / empty (DASH-FB-4).
    path: "/node-packs/:packId",
    name: "pack-detail",
    component: PackDetail,
    meta: { title: "Pack Detail", nav: false },
  },
  {
    path: "/heatmap",
    name: "heatmap",
    component: Heatmap,
    meta: { title: "Heatmap", nav: true },
  },
  {
    path: "/api-diff",
    name: "api-diff",
    component: ApiDiff,
    meta: { title: "API Diff", nav: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
