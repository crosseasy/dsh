import z from '@deepseek-ai/schemastery'

export const inject = ['settings']

export function apply(ctx) {
  ctx.settings.register('overlay-fixture', z.object({
    label: z.string().default('Overlay settings'),
    token: z.string().role('secret').default('fixture-secret-default'),
  }), {
    base: { token: 'fixture-secret-value' },
  })
}
