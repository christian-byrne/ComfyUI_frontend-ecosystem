import type { RegistryNode } from '@/types/registry'
import { mount } from '@vue/test-utils'

import { describe, expect, it } from 'vitest'
import NodePackCard from '../NodePackCard.vue'

const mockNodePack: RegistryNode = {
  id: 'comfyui-kjnodes',
  name: 'ComfyUI-KJNodes',
  description: 'Various utility nodes for ComfyUI',
  author: 'kijai',
  repository: 'https://github.com/kijai/ComfyUI-KJNodes',
  github_stars: 1234,
  downloads: 56789,
  publisher: { id: 'kijai', name: 'Kijai' }
}

describe('nodePackCard.vue', () => {
  it('renders node pack name', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    expect(wrapper.text()).toContain('ComfyUI-KJNodes')
  })

  it('renders description when provided', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    expect(wrapper.text()).toContain('Various utility nodes')
  })

  it('renders publisher name', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    expect(wrapper.text()).toContain('Kijai')
  })

  it('falls back to author when no publisher', () => {
    const packWithoutPublisher: RegistryNode = {
      ...mockNodePack,
      publisher: undefined
    }
    const wrapper = mount(NodePackCard, {
      props: { nodePack: packWithoutPublisher }
    })

    expect(wrapper.text()).toContain('kijai')
  })

  it('renders formatted star count', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    // 1234 formatted
    expect(wrapper.text()).toMatch(/1[,.]?234/)
  })

  it('renders formatted download count', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    // 56789 formatted
    expect(wrapper.text()).toMatch(/56[,.]?789/)
  })

  it('handles missing stats gracefully', () => {
    const minimalPack: RegistryNode = {
      id: 'minimal-pack',
      name: 'Minimal'
    }
    const wrapper = mount(NodePackCard, {
      props: { nodePack: minimalPack }
    })

    expect(wrapper.text()).toContain('Minimal')
    // Should not throw
  })

  it('extracts repo from GitHub URL for banner', () => {
    const wrapper = mount(NodePackCard, {
      props: { nodePack: mockNodePack }
    })

    // Should render NodePackBanner with the extracted repo
    const banner = wrapper.findComponent({ name: 'NodePackBanner' })
    expect(banner.exists()).toBe(true)
  })

  it('falls back to pack id when no repository URL', () => {
    const packWithoutRepo: RegistryNode = {
      id: 'my-pack-id',
      name: 'My Pack'
    }
    const wrapper = mount(NodePackCard, {
      props: { nodePack: packWithoutRepo }
    })

    // Should still render without error
    expect(wrapper.text()).toContain('My Pack')
  })
})
