import { vi } from "vitest";

// Mock @unhead/vue for tests - useHead doesn't need to actually set document.title in unit tests
vi.mock("@unhead/vue", () => ({
  useHead: vi.fn(),
}));
