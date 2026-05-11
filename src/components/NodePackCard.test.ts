import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { RegistryNode } from '@/types/registry'

import NodePackBanner from './NodePackBanner.vue'
import NodePackCard from './NodePackCard.vue'

const fixture: RegistryNode = {
  id: 'comfyui-manager',
  name: 'ComfyUI Manager',
  description: 'Manage your custom nodes from inside ComfyUI.',
  author: 'Comfy-Org',
  publisher: { id: 'comfy-org', name: 'Comfy Org' },
  downloads: 1_240_000,
  github_stars: 14564,
  banner_url: 'https://example.com/banner.png'
}

describe('NodePackCard', () => {
  it('renders title, publisher, description, stars, and downloads', () => {
    const wrapper = mount(NodePackCard, { props: { nodePack: fixture } })

    expect(wrapper.text()).toContain('ComfyUI Manager')
    expect(wrapper.text()).toContain('Comfy Org')
    expect(wrapper.text()).toContain('Manage your custom nodes')
    // Numbers formatted with thousands separators.
    expect(wrapper.text()).toMatch(/14[.,\s]?564/)
    expect(wrapper.text()).toMatch(/1[.,\s]?240[.,\s]?000/)
  })

  it('embeds the banner sub-component with the same pack', () => {
    const wrapper = mount(NodePackCard, { props: { nodePack: fixture } })
    const banner = wrapper.findComponent(NodePackBanner)
    expect(banner.exists()).toBe(true)
    expect(banner.props('nodePack')).toEqual(fixture)
  })

  it('falls back to id when name is missing and hides empty stats', () => {
    const wrapper = mount(NodePackCard, {
      props: {
        nodePack: { id: 'bare-pack' }
      }
    })
    expect(wrapper.text()).toContain('bare-pack')
    // No stars/downloads → no ★ or ↓ glyph rendered.
    expect(wrapper.text()).not.toContain('★')
    expect(wrapper.text()).not.toContain('↓')
  })
})

describe('NodePackBanner', () => {
  it('renders the banner image when banner_url is set', () => {
    const wrapper = mount(NodePackBanner, { props: { nodePack: fixture } })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(fixture.banner_url)
  })

  it('shows the gradient fallback when no media is present', () => {
    const wrapper = mount(NodePackBanner, {
      props: { nodePack: { id: 'bare-pack', name: 'Bare' } }
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[aria-label*="placeholder"]').exists()).toBe(true)
  })
})
