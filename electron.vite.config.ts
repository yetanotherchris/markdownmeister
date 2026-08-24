import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { resolve } from 'path'
import { resolveBuildRevision } from './src/main/buildInfo'

const buildRevision = resolveBuildRevision(process.env.MM_BUILD_COMMIT, () => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
})

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['electron', 'chokidar']
      }
    },
    define: {
      __BUILD_COMMIT__: JSON.stringify(buildRevision)
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    build: {
      outDir: 'out/renderer'
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  }
})
