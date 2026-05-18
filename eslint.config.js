import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  stylistic: {
    semi: false,
    quotes: 'single'
  },
  ignores: ['dist', 'node_modules', '*.md']
})
