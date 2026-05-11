/**
 * Minimal subset of the Comfy Registry `Node` schema used by NodePackCard.
 *
 * Mirrors {@link https://docs.comfy.org/registry/overview the public API}.
 * The upstream OpenAPI surface is much richer (publishers, versions, comfy
 * nodes, security flags, etc.). Keep this trimmed to what the dashboard
 * actually renders; widen on demand instead of importing everything.
 *
 * Runtime validation lives in {@link ./registrySchemas}; the TS types here
 * are inferred from those schemas so the two stay in lock-step.
 */
import type {
  RegistryNode,
  RegistryNodeVersion,
  RegistryPublisher
} from './registrySchemas'

export type { RegistryNode, RegistryNodeVersion, RegistryPublisher }
