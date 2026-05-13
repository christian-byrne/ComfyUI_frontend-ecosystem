import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, RouterView } from "vue-router";

import PatternDetail from "../PatternDetail.vue";

/**
 * Mount-test for the canonical CRITICAL pattern S6.A1
 * (`app.graphToPrompt` monkey-patching). This row is the highest-blast-radius
 * entry in the rollup and exercises every section the page must render:
 * fingerprint, v2_replacement, decision_ref, behavior categories, multiple
 * evidence rows with excerpts, and inline NodePackBanner for repos in the
 * star-cache.
 *
 * Uses the *real* W2 data-loader (no mocking) so the test catches schema
 * drift between the YAML bundles and the page contract.
 */
describe("PatternDetail.vue (S6.A1)", () => {
  function mountAt(id: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/patterns/:id",
          name: "pattern-detail",
          component: PatternDetail,
        },
        // Stub destinations so <RouterLink> resolves cleanly in tests.
        {
          path: "/patterns",
          name: "patterns",
          component: { template: "<div />" },
        },
        {
          path: "/categories/:id",
          name: "category-detail",
          component: { template: "<div />" },
        },
      ],
    });
    router.push(`/patterns/${id}`);
    return router
      .isReady()
      .then(() => mount(RouterView, { global: { plugins: [router] } }));
  }

  it("renders header, surface pair, migration, categories, and evidence for S6.A1", async () => {
    const wrapper = await mountAt("S6.A1");

    // Header
    const header = wrapper.find('[data-testid="pattern-header"]');
    expect(header.exists()).toBe(true);
    expect(header.text()).toContain("S6.A1");
    expect(header.text()).toContain("S6");
    expect(header.text()).toMatch(/blast\s+7/);
    expect(header.text()).toContain("CRITICAL");

    // v1 / v2 surface pair
    const v1 = wrapper.find('[data-testid="surface-v1"]');
    const v2 = wrapper.find('[data-testid="surface-v2"]');
    expect(v1.exists()).toBe(true);
    expect(v2.exists()).toBe(true);
    expect(v1.text()).toContain("graphToPrompt");
    expect(v2.text()).toMatch(/beforeSerialize|beforePrompt/);

    // Migration guidance
    const migration = wrapper.find('[data-testid="migration-path"]');
    expect(migration.exists()).toBe(true);
    expect(migration.text().toLowerCase()).toContain("intent");
    expect(migration.text()).toContain("NEW BLOCKER");
    expect(migration.text()).toContain("WORKFLOW_SERIALIZATION_INTERCEPT");

    // Behavior categories — chips → /categories/:id
    const categories = wrapper.find('[data-testid="categories"]');
    expect(categories.exists()).toBe(true);
    const chips = categories.findAll("a");
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.attributes("href")).toMatch(/^\/categories\/BC\.\d+$/);
    }

    // Evidence — multiple rows
    const evidenceRows = wrapper.findAll('[data-testid="evidence-row"]');
    expect(evidenceRows.length).toBeGreaterThan(2);

    // Inline NodePackBanner: at least one of the evidence repos is in the
    // local star-cache (e.g. Comfy-Org/ComfyUI-Manager / kijai/ComfyUI-KJNodes).
    const banners = wrapper.findAll('[data-testid="node-pack-banner"]');
    expect(banners.length).toBeGreaterThan(0);

    // Contract-test placeholder is rendered but disabled.
    const runner = wrapper.find('[data-testid="contract-test"] button');
    expect(runner.exists()).toBe(true);
    expect(runner.attributes("disabled")).toBeDefined();
  });

  it("toggles evidence excerpts on click", async () => {
    const wrapper = await mountAt("S6.A1");

    const toggles = wrapper.findAll('[data-testid="excerpt-toggle"]');
    // S6.A1 has clone-grep evidence rows with excerpts.
    expect(toggles.length).toBeGreaterThan(0);

    const first = toggles[0];
    expect(first.text()).toBe("show excerpt");
    await first.trigger("click");
    expect(first.text()).toBe("hide excerpt");
  });

  it("renders not-found state for unknown pattern id", async () => {
    const wrapper = await mountAt("XX.NOPE");
    expect(wrapper.find('[data-testid="pattern-not-found"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="pattern-header"]').exists()).toBe(false);
  });
});
