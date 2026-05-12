import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Best-effort build-info: yaml source mtimes + current git sha.
 * Falls back to an empty value when the file or git is unavailable so the
 * dashboard never hard-fails on missing provenance.
 */
function ymlMtime(rel: string): string {
  try {
    return statSync(path.resolve(__dirname, rel)).mtime.toISOString()
  } catch {
    return ''
  }
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

const buildInfo = {
  commitSha: gitSha(),
  yaml: {
    patterns: ymlMtime('research/touch-points-database.yaml'),
    rollup: ymlMtime('research/touch-points-rollup.yaml'),
    starCache: ymlMtime('research/touch-points-star-cache.yaml'),
    behaviorCategories: ymlMtime(
      'research/workspace-mirror/research/touch-points/behavior-categories.yaml'
    )
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts']
  }
})
