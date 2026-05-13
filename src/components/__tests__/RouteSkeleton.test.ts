import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";

import RouteSkeleton from "../RouteSkeleton.vue";

describe("RouteSkeleton.vue", () => {
  function mountWithRouter(routeConfig: {
    path?: string;
    name?: string;
    meta?: Record<string, unknown>;
    title?: string;
  }) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: routeConfig.path ?? "/test",
          name: routeConfig.name ?? "test-route",
          meta: routeConfig.meta ?? {},
          component: RouteSkeleton,
        },
      ],
    });
    router.push(routeConfig.path ?? "/test");
    return router.isReady().then(() =>
      mount(RouteSkeleton, {
        props: { title: routeConfig.title },
        global: { plugins: [router] },
      }),
    );
  }

  it("renders provided title prop", async () => {
    const wrapper = await mountWithRouter({ title: "My Custom Title" });
    expect(wrapper.find("h1").text()).toBe("My Custom Title");
  });

  it("falls back to route meta.title when no prop", async () => {
    const wrapper = await mountWithRouter({
      meta: { title: "Meta Title" },
    });
    expect(wrapper.find("h1").text()).toBe("Meta Title");
  });

  it("falls back to route name when no title or meta", async () => {
    const wrapper = await mountWithRouter({
      name: "my-route-name",
    });
    expect(wrapper.find("h1").text()).toBe("my-route-name");
  });

  it("shows placeholder text indicating W3 implementation", async () => {
    const wrapper = await mountWithRouter({});
    expect(wrapper.text()).toContain("Placeholder route");
    expect(wrapper.text()).toContain("W3");
  });

  it("displays the current route path", async () => {
    const wrapper = await mountWithRouter({ path: "/my/custom/path" });
    expect(wrapper.text()).toContain("/my/custom/path");
  });
});
