import { defineStore } from 'pinia'
import { computed } from 'vue'
import raw from '@/data/behavior-categories.json'
import type { BehaviorCategoriesFile, BehaviorCategory } from '@/types'

const file = raw as BehaviorCategoriesFile

export const useBehaviorCategoriesStore = defineStore('behaviorCategories', () => {
  const categories = computed<BehaviorCategory[]>(() => file.categories)
  const byId = computed(() => {
    const map = new Map<string, BehaviorCategory>()
    for (const c of file.categories) map.set(c.category_id, c)
    return map
  })
  const get = (id: string): BehaviorCategory | undefined => byId.value.get(id)

  return { categories, byId, get }
})
