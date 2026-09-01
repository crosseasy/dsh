export const name = 'curated-behavior-fixture'
export const inject = ['approval', 'sessions', 'tools']

const failures = {
  'search-timeout': 'candidate dsh-web-search-pro stage provider search failed: ETIMEDOUT sk-search-secret',
  'provider-429': 'candidate dsh-llm-fallbacks stage provider request failed: HTTP 429 sk-model-secret',
  'sqlite-lock': 'candidate dsh-memento stage provider open failed: SQLITE_BUSY sk-memory-secret',
  'permission-denied-file': 'candidate dsh-permission-rules stage file read failed: EACCES sk-permission-secret',
  'offline-network': 'candidate upstream-radar stage network request failed: ENOTFOUND sk-offline-secret',
  'illegal-patch': 'candidate fixture-illegal-patch stage patch apply failed: invalid mapping sk-illegal-patch-secret',
  'initialization-exception': 'candidate dsh-agent-team-gui stage initialization failed: sk-init-secret',
}

export function apply(ctx, config = {}) {
  if (config.failInitialization) {
    throw new Error(`candidate fixture-init stage initialization failed: ${config.secret}`)
  }

  let sequence = 0
  let sideEffects = 0
  let order = []

  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec.name !== 'curated_fixture') return next()
    order.push('pre-execute')
    if (exec.arguments.fault === 'approval-denied') return { kind: 'ask', reason: 'fixture mutation' }
    return next()
  })
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name === 'curated_fixture') order.push('execute')
    return next()
  })
  ctx.effect(() => ctx.tools.register({
    name: 'curated_fixture',
    description: 'Exercise curated integration behavior.',
    parameters: {
      fault: { type: 'string' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      order.push('side-effect')
      sideEffects += 1
      const failure = failures[args.fault]
      if (failure !== undefined) throw new Error(failure)
      return 'fixture ok'
    },
  }), 'curated-behavior-fixture.tool')

  const service = {
    sideEffects: () => sideEffects,
    async run(fault) {
      order = []
      const callId = `curated-fixture-${String(++sequence)}`
      const session = ctx.sessions.create(`curated-fixture-session-${String(sequence)}`)
      session.append('turn/start', { turn: 1 })
      session.append('step/start', { turn: 1, step: 1 })
      const call = session.append('tool/call', {
        turn: 1,
        step: 1,
        callId,
        name: 'curated_fixture',
        arguments: JSON.stringify({ fault }),
      })
      const agent = { session }
      const result = await ctx.tools.execute({
        agent,
        signal: new AbortController().signal,
        callId,
        name: 'curated_fixture',
        arguments: { fault },
      })
      session.append('tool/result', {
        turn: 1,
        step: 1,
        message: {
          id: `curated-fixture-result-${String(sequence)}`,
          role: 'user',
          source: { kind: 'tool', callId },
          content: [{
            type: 'tool-result',
            toolCallId: callId,
            content: result.content,
            isError: result.isError,
          }],
        },
        ...(result.error?.info === undefined ? {} : { error: result.error.info }),
      }, { surfaceOp: 'append', sourceEventSeqs: [call.seq] })
      session.append('step/end', { turn: 1, step: 1 })
      session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      return {
        result,
        order: [...order],
        events: session.events.map(event => event.type),
      }
    },
  }
  ctx.effect(() => ctx.provide('curatedBehaviorFixture', service), 'curatedBehaviorFixture.provide')
}
