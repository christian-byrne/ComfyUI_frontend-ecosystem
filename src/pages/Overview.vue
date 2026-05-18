<script setup lang="ts">
import { computed } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { useHead } from "@unhead/vue";

import { useDataStore } from "@/stores/data";

useHead({
  title: "Overview - ComfyUI Frontend Ecosystem",
});

/**
 * Overview — top-level dashboard.
 *
 * Hero numbers + top-12 patterns by blast_radius. The "executive summary"
 * for everyone landing on the ecosystem dashboard.
 */
const data = useDataStore();
const router = useRouter();

/**
 * Defensive named-route helper for pattern-detail links.
 *
 * The `pattern-detail` route is registered on this branch (router/index.ts)
 * but may not exist in every consumer (e.g. tests, embedded shells). Falls
 * back to the path-based form with a console warning so broken links surface
 * loudly in dev rather than 404'ing silently.
 */
function patternRoute(patternId: string): RouteLocationRaw {
  if (router.hasRoute("pattern-detail")) {
    return { name: "pattern-detail", params: { id: patternId } };
  }
  if (import.meta.env.DEV) {
    console.warn(
      `[Overview] route "pattern-detail" not registered; falling back to /patterns/${patternId}`,
    );
  }
  return `/patterns/${patternId}`;
}

const heroStats = computed(() => [
  { label: "patterns", value: data.patterns.length },
  { label: "evidence rows", value: data.totalEvidenceCount },
  { label: "behavior categories", value: data.behaviorCategories.length },
  { label: "starred packs", value: data.starredPacks.length },
]);

const topPatterns = computed(() => data.topByBlastRadius(12));

/**
 * Per-pattern evidence count, looked up from the loaded patterns array.
 * Falls back to the rollup's `occurrences` when a pattern hasn't yet been
 * back-filled with evidence rows during a sweep-in-progress.
 */
function evidenceCount(patternId: string): number {
  const p = data.getPattern(patternId);
  if (p && p.evidence.length > 0) return p.evidence.length;
  return data.getRollup(patternId)?.occurrences ?? 0;
}

/**
 * Pattern descriptions in the rollup are surface_family descriptors (e.g.
 * "S2.N1"). Prefer the database's `semantic` (a human-readable explanation)
 * when available; fall back to the rollup name.
 */
function describe(patternId: string, fallback: string): string {
  return data.getPattern(patternId)?.semantic?.trim() || fallback;
}

const yamlMtime = computed(() => {
  const mtimes = Object.values(__BUILD_INFO__.yaml).filter(Boolean);
  if (mtimes.length === 0) return "unknown";
  // Most recent yaml mtime — that's "how fresh is the data".
  return mtimes.sort().at(-1) ?? "unknown";
});

const commitSha = computed(() => __BUILD_INFO__.commitSha || "unknown");
</script>

<template>
  <section class="space-y-12">
    <!-- Hero numbers -->
    <header>
      <h1 class="sr-only">Overview</h1>
      <dl class="grid grid-cols-2 gap-x-12 gap-y-8 md:grid-cols-4">
        <div v-for="stat in heroStats" :key="stat.label">
          <dt class="text-sm text-zinc-500 dark:text-zinc-400">
            {{ stat.label }}
          </dt>
          <dd
            class="text-5xl font-light text-zinc-900 dark:text-zinc-100 tabular-nums md:text-6xl"
          >
            {{ stat.value.toLocaleString() }}
          </dd>
        </div>
      </dl>
    </header>

    <!-- Top-12 by blast radius -->
    <section aria-labelledby="top-blast-heading" class="space-y-4">
      <h2
        id="top-blast-heading"
        class="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        Top {{ topPatterns.length }} patterns by blast radius
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="text-left text-zinc-500 dark:text-zinc-400">
              <th scope="col" class="py-2 pr-4 font-normal w-8">#</th>
              <th scope="col" class="py-2 pr-4 font-normal">pattern</th>
              <th scope="col" class="py-2 pr-4 font-normal">description</th>
              <th scope="col" class="py-2 pr-4 font-normal text-right">
                blast
              </th>
              <th scope="col" class="py-2 font-normal text-right">evidence</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="topPatterns.length === 0">
              <td
                colspan="5"
                class="py-4 text-center text-zinc-500 dark:text-zinc-400"
              >
                No patterns yet.
              </td>
            </tr>
            <tr
              v-for="(p, idx) in topPatterns"
              v-else
              :key="p.pattern_id"
              class="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <td class="py-2 pr-4 text-zinc-400 dark:text-zinc-500">
                {{ idx + 1 }}
              </td>
              <td class="py-2 pr-4">
                <RouterLink
                  :to="patternRoute(p.pattern_id)"
                  class="text-zinc-900 dark:text-zinc-100 underline-offset-4 hover:underline"
                >
                  {{ p.pattern_id }}
                </RouterLink>
              </td>
              <td class="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                {{ describe(p.pattern_id, p.name) }}
              </td>
              <td class="py-2 pr-4 text-right text-zinc-900 dark:text-zinc-100">
                {{ p.blast_radius.toLocaleString() }}
              </td>
              <td class="py-2 text-right text-zinc-700 dark:text-zinc-300">
                {{ evidenceCount(p.pattern_id).toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Source-of-data footnote -->
    <footer class="text-xs text-zinc-500 dark:text-zinc-400">
      data: yaml mtime
      <time :datetime="yamlMtime">{{ yamlMtime }}</time>
      · build {{ commitSha }}
    </footer>
  </section>
</template>
