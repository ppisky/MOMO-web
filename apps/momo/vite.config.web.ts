import path from 'node:path'
import { loadEnv } from 'vite'
import { productHost } from './scripts/product-host-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function browserBoundary(): Plugin {
  return {
    name: 'momo-browser-boundary',
    resolveId(source, _importer, options) {
      if (!options?.ssr && (/\.server(?:\.|$)/.test(source) || source.startsWith('node:'))) {
        this.error('Server module cannot enter the browser: ' + source)
      }
      if (/^(?:electron(?:\/|$)|electron-|@electron\/)/.test(source)) {
        this.error('Desktop dependency cannot enter the web build: ' + source)
      }
    },
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (/\/src\/(?:main|preload)\/|\.server\.[cm]?[jt]s$/.test(id.replaceAll('\\', '/'))) {
          this.error('Desktop source cannot enter the web build: ' + id)
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  for (const key of ['MOMO_CORE_ORIGIN', 'MOMO_APP_DATA_DIR']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
  }
  return ({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    browserBoundary(),
    productHost(__dirname),
    react(),
    {
      name: 'momo-web-metadata',
      transformIndexHtml() {
        return [{
          tag: 'script',
          children: 'window.chatbox_release_date=' + JSON.stringify(new Date().toISOString().slice(0, 10)) + ';',
          injectTo: 'head-prepend',
        }]
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: { host: '127.0.0.1', port: 1212, strictPort: true },
  preview: { host: '127.0.0.1', port: 1212, strictPort: true },
  define: {
    'process.type': JSON.stringify('renderer'),
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env.CHATBOX_BUILD_TARGET': JSON.stringify('unknown'),
    'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify('web'),
    'process.env.CHATBOX_BUILD_CHANNEL': JSON.stringify('unknown'),
    ...Object.fromEntries(
      ['USE_LOCAL_API', 'USE_BETA_API', 'USE_NEWDB_API', 'USE_LOCAL_CHATBOX', 'USE_BETA_CHATBOX']
        .map((key) => ['process.env.' + key, JSON.stringify(process.env[key] || '')])
    ),
  },
  css: {
    modules: { generateScopedName: '[name]__[local]___[hash:base64:5]' },
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/')
          if (/\/node_modules\/(?:@ai-sdk\/|ai\/)/.test(normalized)) return 'vendor-ai'
          if (/\/node_modules\/(?:@mantine\/|@tabler\/)/.test(normalized)) return 'vendor-ui'
        },
      },
    },
  },
  optimizeDeps: { include: ['mermaid'] },
})
})
