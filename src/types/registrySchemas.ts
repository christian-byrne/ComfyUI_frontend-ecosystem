/**
 * Zod schemas for the Comfy Registry API response shapes.
 *
 * Validated at the fetch boundary in {@link ../services/registryApi.ts} so
 * upstream schema drift surfaces as an explicit error rather than a silently
 * blank card.
 *
 * The upstream OpenAPI surface is much richer than what the dashboard
 * renders; widen these schemas on demand instead of mirroring the whole API.
 * Unknown fields pass through untouched so additive upstream changes don't
 * break the client.
 */
import { z } from 'zod'

export const registryPublisherSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    logo: z.string().optional()
  })
  .passthrough()

export const registryNodeVersionSchema = z
  .object({
    version: z.string().optional(),
    createdAt: z.string().optional()
  })
  .passthrough()

export const registryNodeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    icon: z.string().optional(),
    banner_url: z.string().optional(),
    repository: z.string().optional(),
    downloads: z.number().optional(),
    rating: z.number().optional(),
    github_stars: z.number().optional(),
    publisher: registryPublisherSchema.optional(),
    latest_version: registryNodeVersionSchema.optional(),
    tags: z.array(z.string()).optional()
  })
  .passthrough()

/** Future use: list endpoint envelope (`GET /nodes?...`). */
export const registryNodeListingSchema = z
  .object({
    nodes: z.array(registryNodeSchema),
    total: z.number().optional()
  })
  .passthrough()

export type RegistryPublisher = z.infer<typeof registryPublisherSchema>
export type RegistryNodeVersion = z.infer<typeof registryNodeVersionSchema>
export type RegistryNode = z.infer<typeof registryNodeSchema>
export type RegistryNodeListing = z.infer<typeof registryNodeListingSchema>
