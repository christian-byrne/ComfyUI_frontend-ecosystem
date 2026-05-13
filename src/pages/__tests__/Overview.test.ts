import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import { useDataStore } from "@/stores/data";

import Overview from "../Overview.vue";

// Stub the build-info global the page reads in its template footer.
// vitest sees `__BUILD_INFO__` as undefined unless we wire it up here, since
// the production define-replace only runs in vite, not vitest.
(globalThis as unknown as Record<string, unknown>).__BUILD_INFO__ = {
  commitSha: "testsha1",
  yaml: {
    patterns: "2026-05-08T00:00:00.000Z",
    rollup: "2026-05-08T00:00:00.000Z",
    starCache: "2026-05-08T00:00:00.000Z",
    behaviorCategories: "2026-05-08T00:00:00.000Z",
  },
};

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "overview", component: Overview },
      // Stub destination so RouterLinks resolve cleanly.
      { path: "/patterns/:id", name: "pattern-detail", component: Overview },
    ],
  });
}

describe("Overview.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders hero stats from the data store", async () => {
    // Patch the store after Pinia is active so the component sees fresh values.
    const store = useDataStore();
    vi.spyOn(store, "topByBlastRadius").mockReturnValue([
      {
        pattern_id: "P1",
        surface_family: "S2",
        name: "addExtension",
        occurrences: 12,
        unique_repos: 5,
        cumulative_stars: 1000,
        signature_count: 1,
        silent_breakage: 0,
        lifecycle_coupling: 0,
        blast_radius: 99,
        top_repos: [],
      },
    ]);
    vi.spyOn(store, "getPattern").mockReturnValue(undefined);
    vi.spyOn(store, "getRollup").mockImplementation((id) =>
      id === "P1"
        ? {
            pattern_id: "P1",
            surface_family: "S2",
            name: "addExtension",
            occurrences: 12,
            unique_repos: 5,
            cumulative_stars: 1000,
            signature_count: 1,
            silent_breakage: 0,
            lifecycle_coupling: 0,
            blast_radius: 99,
            top_repos: [],
          }
        : undefined,
    );

    const router = makeRouter();
    router.push("/");
    await router.isReady();

    const wrapper = mount(Overview, {
      global: { plugins: [router] },
    });

    const html = wrapper.html();

    // Hero labels are present.
    expect(html).toContain("patterns");
    expect(html).toContain("evidence rows");
    expect(html).toContain("behavior categories");
    expect(html).toContain("starred packs");

    // Top-12 table renders our injected pattern + a link to its detail page.
    expect(html).toContain("P1");
    expect(html).toContain("addExtension");
    expect(wrapper.find('a[href="/patterns/P1"]').exists()).toBe(true);

    // Footnote shows the build sha.
    expect(html).toContain("testsha1");
  });
});
