<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'

/**
 * PlannedBadge — back-compat wrapper over `<Badge>` (Wave-18 W18.D).
 *
 * The shadcn-style `<Badge>` primitive subsumes the original Wave-17
 * PlannedBadge surface. Existing pages keep importing `PlannedBadge` with
 * the same props (`variant`, `tooltip`, `href`) so callers don't break.
 *
 * Variants:
 * - `phase-b`      → amber  "Phase B"
 * - `ecs-pr-11939` → violet (planned-tone) "ECS (PR #11939)"
 * - `hypothetical` → neutral "Hypothetical"
 */
type PlannedVariant = 'phase-b' | 'ecs-pr-11939' | 'hypothetical'

const props = defineProps<{
  variant: PlannedVariant
  tooltip?: string
  href?: string
}>()

type BadgeVariant = 'neutral' | 'warning' | 'planned'
interface VariantSpec {
  label: string
  badgeVariant: BadgeVariant
}

const VARIANTS: Record<PlannedVariant, VariantSpec> = {
  'phase-b': { label: 'Phase B', badgeVariant: 'warning' },
  'ecs-pr-11939': { label: 'ECS (PR #11939)', badgeVariant: 'planned' },
  hypothetical: { label: 'Hypothetical', badgeVariant: 'neutral' }
}

const spec = computed(() => VARIANTS[props.variant])
</script>

<template>
  <Badge
    :variant="spec.badgeVariant"
    size="xs"
    :href="href"
    :title="tooltip"
    class="rounded-full px-2 py-0.5 text-[11px] normal-case tracking-normal ring-1 ring-inset ring-current/20"
    data-testid="planned-badge"
  >
    <span aria-hidden="true">○</span>
    <span>{{ spec.label }}</span>
  </Badge>
</template>
