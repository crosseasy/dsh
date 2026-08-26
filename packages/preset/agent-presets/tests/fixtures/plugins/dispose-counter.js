// Records mount and disposal counts for generation-lifecycle tests.
export const name = 'dispose-counter'
export const inject = ['tools']

export function apply(ctx, config) {
  const key = config.label
  const counters = globalThis.__PRESET_GENERATION_COUNTERS__ ??= new Map()
  const record = counters.get(key) ?? { applied: 0, disposed: 0 }
  record.applied += 1
  counters.set(key, record)
  ctx.effect(() => () => {
    record.disposed += 1
  })
  ctx.effect(() => ctx.tools.register({
    name: config.tool,
    description: `fixture tool ${config.tool}`,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    execute: () => Promise.resolve(config.tool),
  }))
}
