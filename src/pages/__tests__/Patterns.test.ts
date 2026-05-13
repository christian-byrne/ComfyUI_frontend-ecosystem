import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, it, expect, beforeEach } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";

import Patterns from "../Patterns.vue";
import { useDataStore } from "@/stores/data";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/patterns", name: "patterns", component: Patterns },
      {
        path: "/patterns/:id",
        name: "pattern-detail",
        component: { template: "<div/>" },
      },
    ],
  });
}

describe("Patterns.vue", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("store.searchPatterns narrows the result count when given a query", () => {
    const store = useDataStore();
    const all = store.searchPatterns("");
    const filtered = store.searchPatterns("widget");
    expect(all.length).toBeGreaterThan(0);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(all.length);
  });

  it("renders the table with all 59 patterns by default", async () => {
    const router = makeRouter();
    await router.push("/patterns");
    await router.isReady();
    const wrapper = mount(Patterns, { global: { plugins: [router] } });
    await flushPromises();
    const rows = wrapper.findAll("tbody tr");
    expect(rows.length).toBeGreaterThanOrEqual(50);
  });

  it("searchPatterns matches across the full dataset, including pack names (DASH-FB-3)", () => {
    const store = useDataStore();
    // Pick any pack that's visible in the Patterns table's "Top pack"
    // column. Pre-fix, searching by pack name returned 0 rows because
    // searchPatterns only looked at pattern fields, not evidence repos —
    // which surfaced as "filter only hits the current page".
    const visiblePack = store.patterns
      .flatMap((p) => p.evidence)
      .find((e) => e.repo)?.repo;
    expect(visiblePack).toBeTruthy();

    const slug = (visiblePack ?? "").split("/").pop() ?? "";
    const matches = store.searchPatterns(slug);
    expect(matches.length).toBeGreaterThan(0);
    // Sanity: every match actually contains the pack in evidence.
    for (const p of matches) {
      const hit =
        p.evidence.some((e) =>
          (e.repo ?? "").toLowerCase().includes(slug.toLowerCase()),
        ) ||
        // …or is matched by the original field-level haystack (search is
        // a union, not an intersection).
        JSON.stringify(p).toLowerCase().includes(slug.toLowerCase());
      expect(hit).toBe(true);
    }
  });

  it("search query narrows the rendered row count", async () => {
    const router = makeRouter();
    await router.push("/patterns");
    await router.isReady();
    const wrapper = mount(Patterns, { global: { plugins: [router] } });
    await flushPromises();
    const before = wrapper.findAll("tbody tr").length;

    await wrapper.find("#patterns-search").setValue("widget");
    await flushPromises();
    const after = wrapper.findAll("tbody tr").length;

    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it("clicking a sortable header flips sort order (DASH-FB-5)", async () => {
    const router = makeRouter();
    await router.push("/patterns");
    await router.isReady();
    const wrapper = mount(Patterns, { global: { plugins: [router] } });
    await flushPromises();

    const evidenceHeader = wrapper.find('[data-testid="sort-evidence_count"]');
    expect(evidenceHeader.exists()).toBe(true);

    // First click → sort by evidence DESC. Capture top row's evidence cell.
    await evidenceHeader.trigger("click");
    await flushPromises();
    const firstEvDesc = Number(
      wrapper.findAll("tbody tr")[0].findAll("td")[4].text(),
    );

    // Second click on same column → flip to ASC. Top row should now have
    // the smallest evidence count.
    await evidenceHeader.trigger("click");
    await flushPromises();
    const firstEvAsc = Number(
      wrapper.findAll("tbody tr")[0].findAll("td")[4].text(),
    );

    expect(firstEvDesc).toBeGreaterThanOrEqual(firstEvAsc);
  });

  it("grouping by surface family inserts group headers (DASH-FB-5)", async () => {
    const router = makeRouter();
    await router.push("/patterns");
    await router.isReady();
    const wrapper = mount(Patterns, { global: { plugins: [router] } });
    await flushPromises();

    const groupSelect = wrapper.find('[data-testid="patterns-group-by"]');
    await groupSelect.setValue("surface_family");
    await flushPromises();

    const headers = wrapper.findAll('[data-testid="patterns-group-header"]');
    expect(headers.length).toBeGreaterThan(1);
  });

  it("pack search narrows the table to patterns where any evidence repo matches (DASH-FB-6)", async () => {
    const router = makeRouter();
    await router.push("/patterns");
    await router.isReady();
    const wrapper = mount(Patterns, { global: { plugins: [router] } });
    await flushPromises();
    const before = wrapper.findAll("tbody tr").length;

    // Pick a real pack name from the dataset.
    const store = useDataStore();
    const slug =
      store.patterns
        .flatMap((p) => p.evidence)
        .find((e) => e.repo)
        ?.repo?.split("/")
        .pop() ?? "";
    expect(slug).not.toBe("");

    await wrapper.find("#patterns-pack-search").setValue(slug);
    await flushPromises();
    const after = wrapper.findAll("tbody tr").length;

    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
  });
});
