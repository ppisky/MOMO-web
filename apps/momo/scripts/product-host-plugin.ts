import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

/** The same server module serves dev and the independently built preview. */
export function productHost(root: string): Plugin {
  return {
    name: 'momo-product-host',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.match(/^\/api(?:[/?]|$)/)) return next();
        void server.ssrLoadModule(resolve(root, 'src/product/lib/server/http.server.ts'))
          .then(module => module.middleware(request, response, next))
          .catch(next);
      });
    },
    async configurePreviewServer(server) {
      const module = await import(/* @vite-ignore */ pathToFileURL(resolve(root, 'dist/host/http.mjs')).href);
      server.middlewares.use(module.middleware);
    },
  };
}
