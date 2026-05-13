/**
 * Minimal subset of the Comfy Registry `Node` schema used by NodePackCard.
 *
 * Mirrors {@link https://docs.comfy.org/registry/overview the public API}.
 * The upstream OpenAPI surface is much richer (publishers, versions, comfy
 * nodes, security flags, etc.). Keep this trimmed to what the dashboard
 * actually renders; widen on demand instead of importing everything.
 */
export interface RegistryPublisher {
  id?: string;
  name?: string;
  logo?: string;
}

export interface RegistryNodeVersion {
  version?: string;
  createdAt?: string;
}

export interface RegistryNode {
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  icon?: string;
  banner_url?: string;
  repository?: string;
  downloads?: number;
  rating?: number;
  github_stars?: number;
  publisher?: RegistryPublisher;
  latest_version?: RegistryNodeVersion;
  tags?: string[];
}
