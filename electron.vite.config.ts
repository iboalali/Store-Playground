import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['sharp']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['sharp']
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
