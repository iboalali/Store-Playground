import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        $shared: resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['sharp']
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        $shared: resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['sharp'],
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        $shared: resolve('src/shared'),
        $lib: resolve('src/renderer/src/lib')
      }
    },
    plugins: [svelte()]
  }
})
