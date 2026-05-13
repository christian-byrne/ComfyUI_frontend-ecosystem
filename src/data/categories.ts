/**
 * Behavior categories loader (W3 — moves to its own page in W4).
 *
 * Reads `research/workspace-mirror/research/touch-points/behavior-categories.yaml`
 * via Vite's `?raw` import so it is bundled at build time alongside the rest
 * of the touch-points data.
 */
import { parse as parseYaml } from "yaml";

import categoriesRaw from "../../research/workspace-mirror/research/touch-points/behavior-categories.yaml?raw";
import type {
  BehaviorCategory,
  BehaviorCategoriesFile,
  BehaviorExemplar,
} from "./schema";

export type { BehaviorCategory, BehaviorExemplar };

const file = parseYaml(categoriesRaw) as BehaviorCategoriesFile;

export const behaviorCategories: BehaviorCategory[] = file.categories ?? [];

/** Behavior categories that include the given pattern_id as a member. */
export const categoriesByPatternId: Record<string, BehaviorCategory[]> =
  (() => {
    const out: Record<string, BehaviorCategory[]> = {};
    for (const c of behaviorCategories) {
      for (const pid of c.member_pattern_ids ?? []) {
        (out[pid] ??= []).push(c);
      }
    }
    return out;
  })();
