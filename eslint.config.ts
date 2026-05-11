import pluginJs from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import oxlint from 'eslint-plugin-oxlint'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import {
  configs as tseslintConfigs,
  parser as tseslintParser
} from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

const extraFileExtensions = ['.vue']

const commonParserOptions = {
  parser: tseslintParser,
  ecmaVersion: 2022,
  sourceType: 'module',
  extraFileExtensions
} as const

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'research/**',
      'node_modules/**',
      '**/vite.config.*.timestamp*'
    ]
  },
  pluginJs.configs.recommended,
  ...tseslintConfigs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,mts}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: commonParserOptions
    }
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      globals: { ...globals.browser },
      parserOptions: commonParserOptions
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['src/**/*.{ts,mts,vue}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
  eslintConfigPrettier
])
