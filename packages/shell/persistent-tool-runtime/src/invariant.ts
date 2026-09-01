/** Package-owned invariant companion for `@deepseek-ai/dsh-persistent-tool-runtime/invariant`. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-persistent-tool-runtime'

export const name = 'persistent-tool-runtime-invariant'
export const inject = ['invariants']

/** No runtime invariant: private helper behavior is covered through registered tool packages. */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
