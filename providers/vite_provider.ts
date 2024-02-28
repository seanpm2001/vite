/*
 * @adonisjs/vite
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'

import { Vite } from '../src/vite.js'
import type { ViteOptions } from '../src/types.js'
import ViteMiddleware from '../src/middleware/vite_middleware.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    vite: Vite
  }
}

export default class ViteProvider {
  #shouldRunVite: boolean

  constructor(protected app: ApplicationService) {
    /**
     * We should only run Vite in development and test environments
     */
    const env = this.app.getEnvironment()
    this.#shouldRunVite = (this.app.inDev || this.app.inTest) && (env === 'web' || env === 'test')
  }

  /**
   * Registers edge plugin when edge is installed
   */
  protected async registerEdgePlugin() {
    if (this.app.usingEdgeJS) {
      const edge = await import('edge.js')
      const vite = await this.app.container.make('vite')
      const { edgePluginVite } = await import('../src/plugins/edge.js')
      edge.default.use(edgePluginVite(vite))
    }
  }

  /**
   * Register Vite bindings
   */
  register() {
    const config = this.app.config.get<ViteOptions>('vite')

    const vite = new Vite(this.#shouldRunVite, config)
    this.app.container.bind('vite', () => vite)
    this.app.container.bind(ViteMiddleware, () => new ViteMiddleware(vite))
  }

  /**
   * - Register edge tags
   * - Start Vite server when running in development or test
   */
  async boot() {
    await this.registerEdgePlugin()

    if (!this.#shouldRunVite) return

    const vite = await this.app.container.make('vite')
    const server = await this.app.container.make('server')

    await vite.createDevServer()
    server.use([() => import('../src/middleware/vite_middleware.js')])
  }

  /**
   * Stop Vite server when running in development or test
   */
  async shutdown() {
    if (!this.#shouldRunVite) return

    const vite = await this.app.container.make('vite')
    await vite.stopDevServer()
  }
}
