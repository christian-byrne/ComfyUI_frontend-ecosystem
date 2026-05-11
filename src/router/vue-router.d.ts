/**
 * Type augmentation for vue-router's RouteMeta.
 *
 * Add custom fields used in route definitions here so consumers
 * (App.vue, RouteSkeleton.vue, etc.) get typed access to `route.meta.*`
 * without `as` casts.
 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Human-readable page title shown in the header / skeleton. */
    title?: string
    /** Whether to surface this route in the App.vue header navigation. */
    nav?: boolean
  }
}

export {}
