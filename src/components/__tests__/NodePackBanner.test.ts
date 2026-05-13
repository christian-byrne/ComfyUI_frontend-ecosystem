import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import NodePackBanner from "../NodePackBanner.vue";

describe("NodePackBanner.vue", () => {
  it("renders repo name and links to GitHub", () => {
    const wrapper = mount(NodePackBanner, {
      props: { repo: "kijai/ComfyUI-KJNodes" },
    });

    expect(wrapper.text()).toContain("kijai/ComfyUI-KJNodes");
    expect(wrapper.find("a").attributes("href")).toBe(
      "https://github.com/kijai/ComfyUI-KJNodes",
    );
  });

  it("opens link in new tab with noreferrer", () => {
    const wrapper = mount(NodePackBanner, {
      props: { repo: "test/repo" },
    });

    const link = wrapper.find("a");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noreferrer");
  });

  it("shows stars from star-cache when available", () => {
    // kijai/ComfyUI-KJNodes is in the star cache
    const wrapper = mount(NodePackBanner, {
      props: { repo: "kijai/ComfyUI-KJNodes" },
    });

    // Should show star count, not "☆ ?"
    expect(wrapper.text()).toMatch(/★\s*[\d,]+/);
  });

  it("shows placeholder when repo not in star-cache", () => {
    const wrapper = mount(NodePackBanner, {
      props: { repo: "unknown/not-in-cache" },
    });

    expect(wrapper.text()).toContain("☆ ?");
  });

  it("hides secondary metadata in dense mode", () => {
    const wrapper = mount(NodePackBanner, {
      props: { repo: "kijai/ComfyUI-KJNodes", dense: true },
    });

    // Dense mode should hide forks and last commit
    expect(wrapper.text()).not.toContain("⑂");
    expect(wrapper.text()).not.toContain("last commit");
  });

  it("has correct test-id for querying", () => {
    const wrapper = mount(NodePackBanner, {
      props: { repo: "test/repo" },
    });

    expect(wrapper.find('[data-testid="node-pack-banner"]').exists()).toBe(
      true,
    );
  });
});
