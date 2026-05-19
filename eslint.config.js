import antfu from '@antfu/eslint-config'
import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility'

export default antfu({
  vue: true,
  typescript: true,
  stylistic: {
    semi: false,
    quotes: 'single',
  },
  ignores: ['dist', 'node_modules', '*.md'],
}, {
  plugins: {
    'vuejs-accessibility': vuejsAccessibility,
  },
  rules: {
    'vuejs-accessibility/alt-text': 'error',
    'vuejs-accessibility/anchor-has-content': 'error',
    'vuejs-accessibility/click-events-have-key-events': 'warn',
    'vuejs-accessibility/form-control-has-label': 'error',
    'vuejs-accessibility/label-has-for': 'error',
    'vuejs-accessibility/no-autofocus': 'warn',
  },
})
