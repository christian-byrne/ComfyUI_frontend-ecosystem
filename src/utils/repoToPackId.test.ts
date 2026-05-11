import { describe, expect, it } from 'vitest'

import { repoToPackId } from './repoToPackId'

describe('repoToPackId', () => {
  it('extracts the repo segment of org/repo and lowercases it', () => {
    expect(repoToPackId('Comfy-Org/ComfyUI-Manager')).toBe('comfyui-manager')
    expect(repoToPackId('rgthree/rgthree-comfy')).toBe('rgthree-comfy')
    expect(repoToPackId('kijai/ComfyUI-KJNodes')).toBe('comfyui-kjnodes')
  })

  it('parses full https github URLs', () => {
    expect(repoToPackId('https://github.com/Comfy-Org/ComfyUI-Manager')).toBe(
      'comfyui-manager'
    )
    expect(
      repoToPackId('https://github.com/Comfy-Org/ComfyUI-Manager.git')
    ).toBe('comfyui-manager')
  })

  it('handles worktree-style flat keys with __', () => {
    expect(repoToPackId('Comfy-Org__ComfyUI-Manager')).toBe('comfyui-manager')
  })

  it('returns null for unparseable inputs', () => {
    expect(repoToPackId('')).toBeNull()
    expect(repoToPackId('just-a-repo')).toBeNull()
    expect(repoToPackId('https://example.com/foo/bar')).toBeNull()
  })
})
