/*
 * @adonisjs/vite
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type { cspKeywords as ShieldCSPKeywords } from '@adonisjs/shield'

import debug from '../src/backend/debug.js'
import type { Vite } from '../src/backend/vite.js'
import type { ViteOptions } from '../src/backend/types.js'

/**
 * Extend the container bindings
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    vite: Vite
  }
}

export default class ViteServiceProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Registers edge plugin when edge is installed
   */
  protected async registerEdgePlugin() {
    if (this.app.usingEdgeJS) {
      const edge = await import('edge.js')
      const vite = await this.app.container.make('vite')
      const { edgePluginVite } = await import('../src/backend/plugins/edge.js')
      edge.default.use(edgePluginVite(vite))
    }
  }

  /**
   * Registers CSP keywords when @adonisjs/shield is installed
   */
  protected async registerShieldKeywords() {
    let cspKeywords: typeof ShieldCSPKeywords | null = null
    try {
      const shieldExports = await import('@adonisjs/shield')
      cspKeywords = shieldExports.cspKeywords
    } catch {}

    if (cspKeywords) {
      debug('Detected @adonisjs/shield package. Adding Vite keywords for CSP policy')
      const vite = await this.app.container.make('vite')

      /**
       * Registering the @viteUrl keyword for CSP directives.
       * Returns http URL to the dev or the CDN server, otherwise
       * an empty string
       */
      cspKeywords.register('@viteUrl', function () {
        const assetsURL = vite.assetsUrl()
        if (!assetsURL || !assetsURL.startsWith('http://') || assetsURL.startsWith('https://')) {
          return ''
        }

        return assetsURL
      })

      /**
       * Registering the @viteDevUrl keyword for the CSP directives.
       * Returns the dev server URL in development and empty string
       * in prod
       */
      cspKeywords.register('@viteDevUrl', function () {
        return vite.devUrl()
      })

      /**
       * Registering the @viteHmrUrl keyword for the CSP directives.
       * Returns the Websocket URL for the HMR server
       */
      cspKeywords.register('@viteHmrUrl', function () {
        return vite.devUrl().replace('http://', 'ws://').replace('https://', 'wss://')
      })
    }
  }

  register() {
    this.app.container.singleton('vite', async () => {
      const { Vite } = await import('../src/backend/vite.js')
      const config = this.app.config.get<ViteOptions>('vite')

      return new Vite({
        ...config,
        buildDirectory: this.app.makePath(config.buildDirectory || 'public/build'),
        hotFile: this.app.makePath(config.hotFile || 'public/build/hot.json'),
      })
    })
  }

  async boot() {
    await this.registerEdgePlugin()
    await this.registerShieldKeywords()
  }
}
