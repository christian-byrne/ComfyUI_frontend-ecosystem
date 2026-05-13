/**
 * Behavior categories loader.
 *
 * Reads pre-parsed JSON behavior categories bundled at build time.
 */
import categoriesData from "./behavior-categories.json";
import type {
  BehaviorCategory,
  BehaviorCategoriesFile,
  BehaviorExemplar,
} from "./schema";

export type { BehaviorCategory, BehaviorExemplar };

const file = categoriesData as BehaviorCategoriesFile;

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
