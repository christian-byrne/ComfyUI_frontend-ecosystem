<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { RouterLink } from 'vue-router'

import {
  allAxioms,
  decisionsSorted,
  manifest
} from '@/data/knowledge-loader'

useHead({ title: 'Handoff — ComfyUI Frontend Ecosystem' })

const acceptedAdrs = decisionsSorted.filter((d) =>
  ['accepted', 'shipped'].some((s) => (d.status ?? '').includes(s))
)
const proposedAdrs = decisionsSorted.filter((d) =>
  (d.status ?? '').includes('proposed')
)
const deferredAdrs = decisionsSorted.filter((d) =>
  (d.status ?? '').includes('deferred')
)
const supersededAdrs = decisionsSorted.filter((d) =>
  (d.status ?? '').includes('superseded')
)

const totalKB = Math.round(
  (manifest.decisions.reduce((s, d) => s + d.bytes, 0) +
    manifest.root.reduce((s, r) => s + r.bytes, 0)) /
    1024
)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <header class="mb-8">
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Project Handoff
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        Everything a new engineer needs to take over the ECS + Vue hoisted
        client state + hook API project. Synced from the
        <code class="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800"
          >ecs-vue-hoisted-client-state-hook-api</code
        >
        workspace.
      </p>
    </header>

    <section class="mb-10 rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
      <h2 class="mb-3 text-lg font-semibold text-amber-900 dark:text-amber-200">
        Read these in this order
      </h2>
      <ol class="list-inside list-decimal space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
        <li>
          <RouterLink to="/handoff/root/axioms" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            AXIOMS.md
          </RouterLink>
          — non-negotiable design constraints. {{ allAxioms.length }} active axioms.
        </li>
        <li>
          <RouterLink to="/handoff/root/context" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            CONTEXT.md
          </RouterLink>
          — the running narrative of how we got here.
        </li>
        <li>
          <RouterLink to="/handoff/root/agents" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            AGENTS.md
          </RouterLink>
          — workflow guide + reconciliation history.
        </li>
        <li>
          <RouterLink to="/decisions" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Decisions
          </RouterLink>
          — {{ manifest.decisions.length }} ADRs covering every design call.
        </li>
        <li>
          <RouterLink to="/handoff/root/todo" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            todo.md
          </RouterLink>
          — what's left, decomposed into bite-sized tasks per wave.
        </li>
        <li>
          <RouterLink to="/knowledge-graph" class="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Knowledge graph
          </RouterLink>
          — visual map of how ADRs reference axioms and each other.
        </li>
      </ol>
    </section>

    <section class="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          {{ acceptedAdrs.length }}
        </div>
        <div class="text-xs uppercase tracking-wide text-zinc-500">Accepted / shipped</div>
      </div>
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {{ proposedAdrs.length }}
        </div>
        <div class="text-xs uppercase tracking-wide text-zinc-500">Proposed</div>
      </div>
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-3xl font-bold text-amber-600 dark:text-amber-400">
          {{ deferredAdrs.length }}
        </div>
        <div class="text-xs uppercase tracking-wide text-zinc-500">Deferred</div>
      </div>
      <div class="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="text-3xl font-bold text-zinc-500 dark:text-zinc-400">
          {{ supersededAdrs.length }}
        </div>
        <div class="text-xs uppercase tracking-wide text-zinc-500">Superseded</div>
      </div>
    </section>

    <section class="mb-10 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 class="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Repository map
      </h2>
      <ul class="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <li>
          <strong>Workspace</strong>:
          <code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800"
            >~/cross-repo-tasks/ecs-vue-hoisted-client-state-hook-api</code
          >
          — not a git repo by design; canonical source of ADRs/AXIOMS/CONTEXT.
        </li>
        <li>
          <strong>Frontend worktrees</strong>:
          <code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800"
            >~/worktrees/ComfyUI_frontend/restack-{foundation,pkg,ext,tf}-v2</code
          >
          — the 4 PR branches (#12142–#12145) that ship the API surface.
        </li>
        <li>
          <strong>Frozen surface</strong>:
          <code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800"
            >ComfyUI_frontend/src/extension-api/</code
          >
          at foundation HEAD
          <code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800">ee0537fdb5</code> — no
          changes without a new accepted ADR.
        </li>
        <li>
          <strong>This dashboard</strong>:
          <code class="rounded bg-zinc-100 px-1 dark:bg-zinc-800"
            >christian-byrne/ComfyUI_frontend-ecosystem</code
          >
          — auto-deploys from main via Vercel.
        </li>
      </ul>
    </section>

    <section class="mb-10 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 class="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Open PRs
      </h2>
      <ul class="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        <li>
          <a href="https://github.com/Comfy-Org/ComfyUI_frontend/pull/12142" class="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer">#12142 — foundation</a>
          (will rebase onto Alex's ECS branch #11939 before merge)
        </li>
        <li>
          <a href="https://github.com/Comfy-Org/ComfyUI_frontend/pull/12143" class="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer">#12143 — pkg</a>
        </li>
        <li>
          <a href="https://github.com/Comfy-Org/ComfyUI_frontend/pull/12144" class="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer">#12144 — ext</a>
        </li>
        <li>
          <a href="https://github.com/Comfy-Org/ComfyUI_frontend/pull/12145" class="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noreferrer">#12145 — tf</a>
        </li>
      </ul>
    </section>

    <p class="mt-8 text-xs text-zinc-500">
      Manifest generated {{ manifest.generatedAt }}. {{ manifest.decisions.length }} ADRs,
      {{ manifest.root.length }} root docs, {{ manifest.announcements.length }} announcements
      ({{ totalKB }} KB total).
    </p>
  </div>
</template>
