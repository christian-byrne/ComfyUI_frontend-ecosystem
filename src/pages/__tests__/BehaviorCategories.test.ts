import { describe, it, expect, beforeEach } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import BehaviorCategories from "../BehaviorCategories.vue";
import behaviorCategoriesData from "@/data/behavior-categories.json";

describe("BehaviorCategories grid", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("renders one card per behavior category from the data store", () => {
    const wrapper = mount(BehaviorCategories, {
      global: {
        stubs: { RouterLink: RouterLinkStub },
      },
    });

    const cards = wrapper.findAll('[data-test="bc-card"]');
    expect(cards.length).toBe(behaviorCategoriesData.categories.length);
    expect(cards.length).toBe(41);
  });

  it("shows category id, name, pattern count and a stub-coverage trio per card", () => {
    const wrapper = mount(BehaviorCategories, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    const firstCard = wrapper.find('[data-test="bc-card"]');
    expect(firstCard.text()).toContain("BC.01");
    expect(firstCard.findAll('[data-test^="stub-dot-"]').length).toBe(3);
  });

  it("routes each card to the matching category-detail page", () => {
    const wrapper = mount(BehaviorCategories, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.length).toBeGreaterThanOrEqual(41);
    const first = links[0];
    expect(first.props("to")).toMatchObject({
      name: "category-detail",
      params: { id: "BC.01" },
    });
  });
});
