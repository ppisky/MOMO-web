import path from 'node:path'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import web from './vite.config.web'

function offlineApi(): Plugin {
  return {
    name: 'momo-parameters-demo-api',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './api' && importer?.replaceAll('\\', '/').includes('/src/product/ui/web/'))
        return path.resolve(__dirname, 'demos/model-parameters/api.ts')
    },
  }
}
export default defineConfig((environment) => {
  const base = web(environment)
  // Retain the actual web theme/build boundaries, omit its API host entirely.
  base.plugins = (base.plugins ?? []).filter(
    (plugin) =>
      !(
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        ['momo-product-host', 'momo-web-metadata'].includes(String(plugin.name))
      )
  )
  return mergeConfig(base, {
    root: path.resolve(__dirname, 'demos/model-parameters'),
    plugins: [offlineApi()],
    server: { host: '127.0.0.1', port: 1213, strictPort: true },
    preview: { host: '127.0.0.1', port: 1213, strictPort: true },
    build: { outDir: path.resolve(__dirname, '../../dist/model-parameters-demo') },
  })
})
