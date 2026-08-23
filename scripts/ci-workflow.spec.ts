import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { FUSION_ACCEPTANCE_TIMEOUT_MS } from '../apps/web/tests/fusion-real-process.ts'

const root = resolve(import.meta.dirname, '..')
const runnerPrivatePnpmDestination = '${{ runner.temp }}/setup-pnpm'
const FUSION_CI_RESERVE_MS = 5 * 60_000
const invalidFusionLifecycles = [
  ['a missing timeout', (job: Record<string, unknown>) => delete job['timeout-minutes']],
  ['an insufficient acceptance reserve', (job: Record<string, unknown>) => {
    job['timeout-minutes'] = 10
  }],
  launcherMutation('a direct Chrome launch', run => replaceRequired(run, 'setsid "$chrome_bin"', '"$chrome_bin"')),
  launcherMutation('an unreachable CDP decoy before a direct launch', addUnreachableChromeDecoy),
  launcherMutation('commented and echoed cleanup traps',
    run => replaceRequired(run, 'trap cleanup EXIT', '# trap cleanup EXIT\necho "trap cleanup EXIT"')),
  launcherMutation('an EXIT trap cleared before acceptance',
    run => replaceRequired(run, 'trap cleanup EXIT', 'trap cleanup EXIT\ntrap - EXIT')),
  launcherMutation('an EXIT trap cleared after acceptance',
    run => replaceRequired(run, 'pnpm run test:fusion:acceptance:built', 'pnpm run test:fusion:acceptance:built\ntrap - EXIT')),
  launcherMutation('commented and echoed TERM',
    run => replaceRequired(run, 'kill -TERM -- "-$chrome_pid" 2>/dev/null || true', '# kill -TERM -- "-$chrome_pid" 2>/dev/null || true\necho \'kill -TERM -- "-$chrome_pid" 2>/dev/null || true\'')),
  launcherMutation('unbounded Chrome liveness polling',
    run => replaceRequired(run, 'for _ in {1..20}; do', 'while true; do')),
  launcherMutation('commented and echoed KILL',
    run => replaceRequired(run, 'kill -KILL -- "-$chrome_pid" 2>/dev/null || true', '# kill -KILL -- "-$chrome_pid" 2>/dev/null || true\necho \'kill -KILL -- "-$chrome_pid" 2>/dev/null || true\'')),
  launcherMutation('commented and echoed process wait',
    run => replaceRequired(run, 'wait "$chrome_pid" 2>/dev/null || true', '# wait "$chrome_pid" 2>/dev/null || true\necho \'wait "$chrome_pid" 2>/dev/null || true\'')),
  launcherMutation('an early cleanup return',
    run => replaceRequired(run, 'cleanup() {', 'cleanup() {\n  return 0')),
  launcherMutation('cleanup hidden behind a conditional return',
    run => replaceRequired(run, 'cleanup() {', 'cleanup() {\n  if [[ -n "$chrome_profile" ]]; then\n    return 0\n  fi')),
  launcherMutation('cleanup defined after acceptance', moveCleanupAfterAcceptance),
  launcherMutation('readiness marked before the probe', moveReadinessSuccessBeforeProbe),
  launcherMutation('an unreachable readiness probe', hideReadinessProbe),
  launcherMutation('readiness after acceptance', moveReadinessAfterAcceptance),
  launcherMutation('commented and echoed profile removal',
    run => replaceRequired(run, 'rm -rf "$chrome_profile"', '# rm -rf "$chrome_profile"\necho \'rm -rf "$chrome_profile"\'')),
  launcherMutation('a disconnected temporary profile',
    run => replaceRequired(run, '--user-data-dir="$chrome_profile"', '--user-data-dir="$RUNNER_TEMP/fusion-chrome-profile"')),
] as const

const equivalentFusionLifecycleSpellings = [
  ['quoted command substitutions', (run: string) => replaceRequired(
    replaceRequired(run, 'chrome_bin=$(command -v google-chrome)', 'chrome_bin="$(command -v google-chrome)"'),
    'chrome_profile=$(mktemp -d)', 'chrome_profile="$(mktemp -d)"',
  )],
  ['setsid option termination', (run: string) => replaceRequired(run, 'setsid "$chrome_bin"', 'setsid -- "$chrome_bin"')],
  ['rm option termination', (run: string) => replaceRequired(run, 'rm -rf "$chrome_profile"', 'rm -rf -- "$chrome_profile"')],
] as const

describe('CI workflow', () => {
  it('isolates every pnpm action setup destination per runner', () => {
    const workflow: unknown = yaml.load(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'))
    if (!isRecord(workflow) || !isRecord(workflow.jobs)) throw new TypeError('CI workflow must define jobs')

    const setups = Object.entries(workflow.jobs).flatMap(([jobName, job]) => {
      if (!isRecord(job) || !Array.isArray(job.steps)) return []
      return job.steps.flatMap((step) => {
        if (!isRecord(step) || typeof step.uses !== 'string' || !step.uses.startsWith('pnpm/action-setup@')) return []
        return [{ jobName, step }]
      })
    })

    expect(setups.length).toBeGreaterThan(0)
    for (const { jobName, step } of setups) {
      expect(step, `${jobName} must not share pnpm/action-setup's default destination`).toMatchObject({
        with: { dest: runnerPrivatePnpmDestination },
      })
    }
  })

  it('requires Fusion replay on an isolated standard-hosted pull-request job', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    const fusion = workflowJob(workflow, 'fusion-acceptance')
    const consumers = workflowJob(workflow, 'node-24-consumers')
    const aggregate = workflowJob(workflow, 'all-checks-passed')
    if (!Array.isArray(fusion.steps)
      || !Array.isArray(consumers.steps)
      || !Array.isArray(aggregate.needs)) {
      throw new TypeError('Fusion, consumer, and aggregate jobs must define their execution topology')
    }

    expect(fusion).toMatchObject({
      if: "github.event_name == 'pull_request'",
      name: 'fusion / external-profile snapshot',
      'runs-on': 'ubuntu-latest',
    })
    expect(JSON.stringify(fusion)).not.toContain('DSH_CI_FAILOVER_LINUX')
    expect(JSON.stringify(consumers.steps)).not.toContain('test:fusion:acceptance:built')
    expect(aggregate.needs).toContain('fusion-acceptance')

    const commands = fusion.steps
      .filter((step): step is Record<string, unknown> & { run: string } => (
        isRecord(step) && typeof step.run === 'string'
      ))
    expect(commands.map(step => step.run)).toContain('pnpm install --frozen-lockfile')
    expect(commands.map(step => step.run)).toContain('pnpm run build')
    const preflight = commands.find(step => step.name === 'Preflight system Chrome dependencies')
    expect(preflight?.run).toContain('command -v google-chrome')
    expect(preflight?.run).toContain('command -v setsid')
    expect(preflight?.run).toContain('command -v curl')
    const launcher = commands.find(step => step.run.includes('--remote-debugging-port=9333'))
    expect(launcher).toMatchObject({ env: { DSH_SNAPSHOT: 'replay' } })
    expect(launcher?.run).toContain('--headless=new')
    expect(launcher?.run).not.toContain('xvfb')
    expect(launcher?.run).toContain('curl --silent --show-error --fail --max-time 1')
    expect(launcher?.run).toContain('kill -TERM -- "-$chrome_pid"')
    expect(launcher?.run).toContain('kill -KILL -- "-$chrome_pid"')
    expect(launcher?.run).toContain('pnpm run test:fusion:acceptance:built')
    expect(hasFusionLifecycleContract(fusion)).toBe(true)
  })

  it('keeps the Fusion job outside the acceptance timeout with setup and cleanup reserve', () => {
    const fusion = workflowJob(loadWorkflow('.github/workflows/ci.yml'), 'fusion-acceptance')
    expect(fusion['timeout-minutes']).toBeTypeOf('number')
    const jobTimeoutMs = (fusion['timeout-minutes'] as number) * 60_000

    expect(jobTimeoutMs).toBeGreaterThan(FUSION_ACCEPTANCE_TIMEOUT_MS)
    expect(jobTimeoutMs - FUSION_ACCEPTANCE_TIMEOUT_MS).toBeGreaterThanOrEqual(FUSION_CI_RESERVE_MS)
  })

  it.each(invalidFusionLifecycles)('rejects %s', (_, mutate) => {
    const fusion = structuredClone(workflowJob(loadWorkflow('.github/workflows/ci.yml'), 'fusion-acceptance'))
    mutate(fusion)

    expect(hasFusionLifecycleContract(fusion)).toBe(false)
  })

  it.each(equivalentFusionLifecycleSpellings)('accepts %s', (_, mutate) => {
    const fusion = structuredClone(workflowJob(loadWorkflow('.github/workflows/ci.yml'), 'fusion-acceptance'))
    mutateFusionLauncher(fusion, mutate)

    expect(hasFusionLifecycleContract(fusion)).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('executes Fusion acceptance and cleanup through Bash before returning', () => {
    const fusion = workflowJob(loadWorkflow('.github/workflows/ci.yml'), 'fusion-acceptance')
    const launcher = commandSteps(fusion).find(
      step => step.name === 'Run Fusion external-profile snapshot with system Google Chrome',
    )
    if (launcher === undefined) throw new TypeError('Fusion job must define the Chrome launcher')

    expect(runFusionLauncherProbe(launcher.run)).toMatchObject({
      acceptanceCalled: true,
      accepted: true,
      childExited: true,
      childFinishedBeforeReturn: true,
      profileRemoved: true,
      status: 0,
    })
  }, 15_000)

  it.skipIf(process.platform === 'win32')('rejects an unreachable acceptance command through Bash', () => {
    const fusion = workflowJob(loadWorkflow('.github/workflows/ci.yml'), 'fusion-acceptance')
    const launcher = commandSteps(fusion).find(
      step => step.name === 'Run Fusion external-profile snapshot with system Google Chrome',
    )
    if (launcher === undefined) throw new TypeError('Fusion job must define the Chrome launcher')
    const unreachable = replaceRequired(
      launcher.run,
      'pnpm run test:fusion:acceptance:built',
      'if [[ 1 -eq 0 ]]; then\n  pnpm run test:fusion:acceptance:built\nfi',
    )

    expect(runFusionLauncherProbe(unreachable)).toMatchObject({
      acceptanceCalled: false,
      accepted: false,
      childExited: true,
      childFinishedBeforeReturn: true,
      profileRemoved: true,
      status: 0,
    })
  }, 15_000)

  it('keeps a required Wine Windows job, a non-blocking native Windows job with failover, and a master-only standby', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    if (!isRecord(workflow.jobs)
      || !isRecord(workflow.jobs.windows)
      || !isRecord(workflow.jobs['windows-native'])
      || !isRecord(workflow.jobs['wine-apt-cache'])
      || !isRecord(workflow.jobs['serial-windows'])
      || !isRecord(workflow.jobs['node-24'])
      || !isRecord(workflow.jobs['node-24-coverage'])
      || !isRecord(workflow.jobs['node-24-consumers'])
      || !isRecord(workflow.jobs['all-checks-passed'])) {
      throw new TypeError('CI workflow must define windows, windows-native, wine-apt-cache, serial-windows, node-24, node-24-coverage, node-24-consumers, and all-checks-passed jobs')
    }

    const windows = workflow.jobs.windows
    const windowsNative = workflow.jobs['windows-native']
    const wineAptCache = workflow.jobs['wine-apt-cache']
    const serialWindows = workflow.jobs['serial-windows']
    const node24 = workflow.jobs['node-24']
    const node24Coverage = workflow.jobs['node-24-coverage']
    const node24Consumers = workflow.jobs['node-24-consumers']
    const aggregate = workflow.jobs['all-checks-passed']
    if (!Array.isArray(windows.steps) || !Array.isArray(aggregate.needs)) {
      throw new TypeError('Windows job must define steps and the aggregate must define needs')
    }
    const commandSteps = windows.steps.filter((step): step is Record<string, unknown> & { run: string } => (
      isRecord(step) && typeof step.run === 'string'
    ))

    // Required PR job: Wine on ubuntu-latest, runs wine-windows-gates.sh.
    expect(windows['runs-on']).toBe('ubuntu-latest')
    expect(windows.name).toBe('windows node 24 / wine blocking')
    expect(windows.if).toBe("github.event_name == 'pull_request'")
    expect(commandSteps.some(step => step.run.includes('wine-windows-gates.sh'))).toBe(true)

    // windows-native: non-blocking native job with failover, runs windows-complete.
    // Its pool is resolved by the Windows-specific switch.
    expect(typeof windowsNative['runs-on']).toBe('string')
    expect(windowsNative['runs-on']).toContain('DSH_CI_FAILOVER_WINDOWS')
    expect(windowsNative['runs-on']).not.toContain('DSH_CI_FAILOVER_LINUX')
    expect(windowsNative['runs-on']).toContain('self-hosted')
    expect(windowsNative['runs-on']).toContain('dsh-win-ci')
    expect(windowsNative['runs-on']).toContain('dsh-windows-2025-16core')
    expect(windowsNative.name).toBe('windows node 24 / native complete')
    expect(windowsNative.if).toBe("github.event_name == 'pull_request'")
    const nativeCommandSteps = (windowsNative.steps as unknown[]).filter((step): step is Record<string, unknown> & { run: string } => (
      isRecord(step) && typeof step.run === 'string'
    ))
    expect(nativeCommandSteps.map(step => step.run)).toContain('pnpm run check:ci:windows-complete')

    // wine-apt-cache: master-only, seeds the Wine apt cache.
    expect(wineAptCache.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/master'")
    expect(wineAptCache['runs-on']).toBe('ubuntu-latest')

    // serial-windows: master-only standby, self-hosted, non-blocking.
    expect(serialWindows.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/master'")
    expect(serialWindows['runs-on']).toEqual(['self-hosted', 'dsh-win-ci', 'windows'])
    expect(serialWindows.name).toBe('serial / windows (self-hosted standby)')

    // Aggregate: Wine `windows` required, native `windows-native` excluded.
    expect(aggregate.needs).toContain('windows')
    expect(aggregate.needs).not.toContain('windows-native')
    expect(aggregate.needs).not.toContain('serial-windows')

    // Linux failover is a separate switch: the three required Linux workers
    // and the verdict job resolve their pool through DSH_CI_FAILOVER_LINUX,
    // never the Windows switch.
    for (const [jobName, job] of [['node-24', node24], ['node-24-coverage', node24Coverage], ['node-24-consumers', node24Consumers]] as const) {
      expect(typeof job['runs-on']).toBe('string')
      expect(job['runs-on'], `${jobName} runs-on must use the Linux failover switch`).toContain('DSH_CI_FAILOVER_LINUX')
      expect(job['runs-on'], `${jobName} runs-on must not use the Windows failover switch`).not.toContain('DSH_CI_FAILOVER_WINDOWS')
      expect(job['runs-on']).toContain('vm-backup')
    }
    expect(aggregate['runs-on']).toContain('DSH_CI_FAILOVER_LINUX')
    expect(aggregate['runs-on']).not.toContain('DSH_CI_FAILOVER_WINDOWS')
    expect(aggregate['runs-on']).toContain('vm-backup')
  })

  it('exempts push from cancellation, so one master merge does not cancel the running drill', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    if (!isRecord(workflow.jobs) || !isRecord(workflow.concurrency)) {
      throw new TypeError('CI workflow must define jobs and a workflow-level concurrency block')
    }

    // Cancellation applies to the whole superseded RUN, so this has to be
    // decided at workflow level and gated on the event: a job-level group
    // cannot exempt its job from its run being cancelled. Only push is exempt —
    // a drill takes longer than the interval between master merges. The negated
    // form is load-bearing: `== 'pull_request'` would also stop cancelling
    // workflow_dispatch, and a re-dispatched runner benchmark holds up to 12
    // larger runners for 15 minutes in this same group on master. The
    // expression is evaluated against the NEWLY TRIGGERED run, so a dispatch on
    // master still cancels a mid-flight drill; the runbook records that bound.
    expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.event_name != 'push' }}")

    // Neither drill may carry a job-level group: it would not exempt the job
    // from run-scoped cancellation.
    for (const name of ['serial-linux-selfhosted', 'serial-windows']) {
      const job = workflow.jobs[name]
      if (!isRecord(job)) throw new TypeError(`${name} must be defined`)
      expect(job.concurrency).toBeUndefined()
      // Both stay master-push-only; that is what makes the push carve-out safe.
      expect(job.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/master'")
    }

    // What bounds the cost of exempting push: a master push may only carry the
    // cache seeder and the two drills. Any job reachable on push would start
    // accumulating uncancelled runs, so the set is pinned here.
    //
    // Classification is an exact allowlist of the conditions in use, not a
    // substring match: `github.event_name != 'pull_request'` mentions
    // `pull_request` yet IS push-reachable, so matching on the event name alone
    // would silently misclassify it as gated.
    const NOT_PUSH_REACHABLE = new Set([
      "github.event_name == 'pull_request'",
      "always() && github.event_name == 'pull_request'",
      "github.event_name == 'workflow_dispatch' && inputs.suite == 'larger-runner-benchmark'",
      "github.event_name == 'workflow_dispatch' && inputs.suite == 'consolidated-runner-benchmark'",
    ])
    const pushReachable = Object.entries(workflow.jobs)
      .filter(([, job]) => {
        if (!isRecord(job)) return false
        if (job.if === undefined) return true // unconditional: runs on every event
        if (job.if === false) return false // `if: false` parses as a boolean
        if (typeof job.if !== 'string') return true // unrecognized shape: surface it
        return !NOT_PUSH_REACHABLE.has(job.if.trim())
      })
      .map(([name]) => name)
      .sort()
    expect(pushReachable).toEqual(['serial-linux-selfhosted', 'serial-windows', 'wine-apt-cache'])

    // Why workflow_dispatch must keep cancelling: each benchmark fans out to a
    // dozen larger runners at once, in this same group on master. If it stopped
    // cancelling, a re-dispatch would queue ahead of a drill instead of
    // replacing the stale measurement.
    for (const name of ['larger-runner-benchmark', 'consolidated-runner-benchmark']) {
      const job = workflow.jobs[name]
      if (!isRecord(job) || !isRecord(job.strategy)) {
        throw new TypeError(`${name} must define a matrix strategy`)
      }
      expect(job.strategy['max-parallel']).toBe(12)
      expect(job['timeout-minutes']).toBe(15)
    }
  })

  it('keeps supported LSP source under native Windows coverage', () => {
    const config = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8')

    expect(config).not.toContain('packages/lsp/lsp-stdio/src/connection.ts')
    expect(config).not.toContain('packages/lsp/lsp-stdio/src/index.ts')
    expect(config).not.toContain('packages/lsp/lsp-stdio/src/instance.ts')
  })

  it('requires one release-shaped Python runtime target on every pull request', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    const pythonRuntime = workflowJob(workflow, 'python-runtime')
    const aggregate = workflowJob(workflow, 'all-checks-passed')
    if (!Array.isArray(aggregate.needs)) {
      throw new TypeError('CI aggregate must define required job dependencies')
    }

    expect(pythonRuntime).toMatchObject({
      if: "github.event_name == 'pull_request'",
      name: 'python runtime / release-shaped Linux x64',
      uses: './.github/workflows/build-exe-for-python-sdk.yml',
      with: {
        targets: 'node24-linux-x64',
        ci: true,
      },
    })
    expect(aggregate.needs).toContain('python-runtime')
  })

  it('keeps every Vitest project process-isolated on native Windows', () => {
    const config = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8')

    expect(config).not.toContain("pool: process.platform === 'win32' ? 'threads' : 'forks'")
    expect(config.match(/pool: 'forks'/g)).toHaveLength(2)
  })
})

describe('E2B e2e workflow', () => {
  it('is manual-only and fails loud before running the focused live suite', () => {
    const workflow = loadWorkflow('.github/workflows/e2b-e2e.yml')
    expect(workflow.on).toEqual({ workflow_dispatch: null })
    if (!isRecord(workflow.jobs) || !isRecord(workflow.jobs.e2b) || !Array.isArray(workflow.jobs.e2b.steps)) {
      throw new TypeError('E2B e2e workflow must define the e2b job steps')
    }

    const steps = workflow.jobs.e2b.steps.filter(isRecord)
    const preflight = steps.find(step => step.name === 'Preflight (require E2B API key)')
    const e2b = steps.find(step => step.name === 'E2B tests (live sandbox)')

    expect(preflight).toMatchObject({
      env: { E2B_API_KEY: '${{ secrets.E2B_API_KEY_EXTERNAL }}' },
    })
    expect(preflight?.run).toContain('E2B_API_KEY_EXTERNAL repository secret')
    expect(e2b).toMatchObject({
      env: {
        E2B_API_KEY: '${{ secrets.E2B_API_KEY_EXTERNAL }}',
        DSH_E2E_MAX_WORKERS: '1',
        DSH_EXAMPLE_MODE: 'lib',
      },
    })
    expect(e2b?.run).toContain('packages/e2b/e2b/tests/composition.e2e.ts')
  })
})

describe('Python release workflows', () => {
  it('keeps complete wheel validation separate from protected public publication', () => {
    const workflow = loadWorkflow('.github/workflows/python-release.yml')
    const dispatch = workflowEvent(workflow, 'workflow_dispatch')
    const pullRequest = workflowEvent(workflow, 'pull_request')
    const build = workflowJob(workflow, 'build')
    const pythonCompat = workflowJob(workflow, 'python-compat')
    const validate = workflowJob(workflow, 'validate')
    const publishRuntime = workflowJob(workflow, 'publish-runtime')
    const publishSdk = workflowJob(workflow, 'publish-sdk')
    if (!isRecord(dispatch.inputs)
      || !isRecord(dispatch.inputs.publish)
      || !Array.isArray(pythonCompat.steps)
      || !Array.isArray(validate.steps)
      || !Array.isArray(publishRuntime.steps)
      || !Array.isArray(publishSdk.steps)) {
      throw new TypeError('Python release workflow must define publish input and release steps')
    }

    expect(dispatch.inputs.publish).toMatchObject({ type: 'boolean', default: false })
    expect(pullRequest).toEqual({ types: ['labeled'] })
    expect(build).toMatchObject({
      if: "github.event_name == 'workflow_dispatch' || github.event.label.name == 'python-release-dry-run'",
      uses: './.github/workflows/build-exe-for-python-sdk.yml',
      with: {
        targets: 'node24-linux-x64,node24-linux-arm64,node24-macos-arm64',
        release: true,
      },
    })
    expect(pythonCompat.strategy).toMatchObject({ matrix: { python: ['3.10', '3.14'] } })
    expect(JSON.stringify(pythonCompat.steps)).toContain('deepseek-harness-sdk==${{ steps.compatibility-version.outputs.version }}')
    const validateSteps = JSON.stringify(validate.steps)
    const authorize = validate.steps.filter(isRecord).find(step => step.name === 'Authorize publication request')
    if (!isRecord(authorize) || typeof authorize.run !== 'string') {
      throw new TypeError('Python release validation must authorize publication requests')
    }
    expect(validateSteps).toContain('PUBLIC_PYPI_RELEASE_ENABLED')
    expect(authorize).toMatchObject({
      env: {
        PYPI_PUBLISHER_REPOSITORY: '${{ vars.PYPI_PUBLISHER_REPOSITORY }}',
        REPOSITORY: '${{ github.repository }}',
      },
    })
    expect(authorize.run).toContain('[ "$REPOSITORY" = "$PYPI_PUBLISHER_REPOSITORY" ]')
    expect(validateSteps).toContain('100000000')
    expect(publishRuntime).toMatchObject({
      if: "github.event_name == 'workflow_dispatch' && inputs.publish",
      needs: 'validate',
      environment: 'pypi-runtime',
      permissions: { contents: 'read', 'id-token': 'write' },
    })
    expect(publishSdk).toMatchObject({
      if: "github.event_name == 'workflow_dispatch' && inputs.publish",
      needs: ['validate', 'publish-runtime'],
      environment: 'pypi',
      permissions: { contents: 'read', 'id-token': 'write' },
    })
    const runtimeSteps = publishRuntime.steps.filter(isRecord)
    const sdkSteps = publishSdk.steps.filter(isRecord)
    const runtimePublish = runtimeSteps.find(step => step.name === 'Publish runtime wheels')
    const sdkPublish = sdkSteps.find(step => step.name === 'Publish SDK wheel')
    const runtimeHashes = runtimeSteps.find(step => step.name === 'Verify release artifact hashes')
    const sdkHashes = sdkSteps.find(step => step.name === 'Verify release artifact hashes')
    expect([...runtimeSteps, ...sdkSteps].some(
      step => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'),
    )).toBe(false)
    expect([...runtimeSteps, ...sdkSteps].filter(
      step => step.uses === 'pypa/gh-action-pypi-publish@release/v1',
    )).toHaveLength(2)
    expect(runtimePublish).toMatchObject({
      with: { 'packages-dir': 'dist/runtime/', attestations: false },
    })
    expect(sdkPublish).toMatchObject({
      with: { 'packages-dir': 'dist/sdk/', attestations: false },
    })
    expect(runtimeHashes).toMatchObject({ run: 'cd dist && sha256sum -c SHA256SUMS' })
    expect(sdkHashes).toMatchObject({ run: 'cd dist && sha256sum -c SHA256SUMS' })
  })

  it('exposes the native wheel builder to the release caller with normalized versions', () => {
    const workflow = loadWorkflow('.github/workflows/build-exe-for-python-sdk.yml')
    const call = workflowEvent(workflow, 'workflow_call')
    const plan = workflowJob(workflow, 'plan')
    const build = workflowJob(workflow, 'build')
    if (!isRecord(call.inputs) || !Array.isArray(plan.steps) || !Array.isArray(build.steps)) {
      throw new TypeError('Python wheel builder must define workflow_call inputs and plan steps')
    }

    const buildSteps: unknown[] = build.steps
    const manylinuxAddon = buildSteps.find(step => isRecord(step) && step.name === 'Rebuild Linux node-pty against manylinux 2.28')
    const macosCheck = buildSteps.find(step => isRecord(step) && step.name === 'Check macOS deployment target')
    const manylinuxSmoke = buildSteps.find(step => isRecord(step) && step.name === 'Run wheel in a manylinux 2.28 container')
    expect(call.inputs).toHaveProperty('targets')
    expect(call.inputs).toMatchObject({
      ci: { type: 'boolean', default: false },
      release: { type: 'boolean', default: false },
    })
    expect(workflow.concurrency).toMatchObject({
      group: 'build-single-exe-${{ github.workflow }}-${{ github.ref }}',
    })
    expect(plan.if).toContain('inputs.ci')
    expect(plan.if).toContain('inputs.release')
    expect(JSON.stringify(plan.steps)).toContain('pep440_version')
    expect(JSON.stringify(workflow)).toContain('macosx_14_0_arm64')
    expect(manylinuxAddon).toMatchObject({ if: "runner.os == 'Linux'" })
    expect(JSON.stringify(manylinuxAddon)).toContain('manylinux_2_28_x86_64')
    expect(JSON.stringify(manylinuxAddon)).toContain('manylinux_2_28_aarch64')
    expect(JSON.stringify(manylinuxAddon)).toContain('$HOME/setup-pnpm:$HOME/setup-pnpm:ro')
    expect(JSON.stringify(manylinuxAddon)).toContain('node-pty-glibc-versions.txt')
    expect(JSON.stringify(manylinuxAddon)).toContain('le 2.28')
    expect(macosCheck).toMatchObject({ if: "runner.os == 'macOS'" })
    expect(JSON.stringify(macosCheck)).toContain('scripts/check-macos-deployment-target.py')
    expect(JSON.stringify(macosCheck)).toContain('$EXE-spawn-helper')
    expect(manylinuxSmoke).toMatchObject({ if: "runner.os == 'Linux'" })
    expect(JSON.stringify(manylinuxSmoke)).toContain('-e DSH_TELEMETRY_DISABLED')
  })

  it('uses the shared macOS deployment-target check in GitLab', () => {
    const workflow = loadWorkflow('.gitlab-ci.yml')
    const runtimeWheel = workflow['.runtime-wheel']
    if (!isRecord(runtimeWheel) || !Array.isArray(runtimeWheel.script)) {
      throw new TypeError('GitLab CI must define the runtime wheel script')
    }
    const runtimeScript: unknown[] = runtimeWheel.script
    const macosCheck = runtimeScript.find(
      step => typeof step === 'string' && step.includes('PLATFORM" = macos-arm64'),
    )
    if (typeof macosCheck !== 'string') {
      throw new TypeError('GitLab CI must check the macOS deployment target')
    }

    expect(macosCheck).toContain('scripts/check-macos-deployment-target.py')
    expect(macosCheck).toContain('"$EXE" "$EXE-spawn-helper"')
  })
})

describe('Issue lifecycle workflow', () => {
  it('uses explicit review handoff events without rerunning when a draft becomes ready', () => {
    const lifecycle = loadWorkflow('.github/workflows/issue-lifecycle.yml')
    const lifecyclePullRequest = workflowEvent(lifecycle, 'pull_request')
    const lifecycleReview = workflowEvent(lifecycle, 'pull_request_review')
    const lifecycleJob = workflowJob(lifecycle, 'lifecycle')
    const policy = loadWorkflow('.github/workflows/issue-policy.yml')
    const policyPullRequest = workflowEvent(policy, 'pull_request')

    expect(lifecyclePullRequest.types).not.toContain('ready_for_review')
    expect(lifecyclePullRequest.types).toContain('review_requested')
    expect(lifecycleReview.types).toEqual(['submitted'])
    expect(lifecycleJob.if).toBe(
      "${{ github.event_name != 'pull_request_review' || (github.event.action == 'submitted' && github.event.review.state == 'changes_requested') }}",
    )
    expect(policyPullRequest.types).toContain('ready_for_review')
  })
})

describe('Git hooks', () => {
  it('leaves frozen Agent Note sidecars to the archive verifier', () => {
    const lefthook = loadWorkflow('lefthook.yml')

    for (const hookName of ['pre-commit', 'pre-merge-commit']) {
      const hook = lefthook[hookName]
      if (!isRecord(hook) || !Array.isArray(hook.jobs)) {
        throw new TypeError(`lefthook must define ${hookName} jobs`)
      }
      const pairing: unknown = hook.jobs.find(
        (job: unknown) => isRecord(job) && job.name === 'translation pairing (staged records)',
      )

      expect(pairing).toMatchObject({ exclude: ['.agents/notes/archived/**'] })
    }
  })
})

function loadWorkflow(path: string): Record<string, unknown> {
  const workflow: unknown = yaml.load(readFileSync(resolve(root, path), 'utf8'))
  if (!isRecord(workflow)) throw new TypeError(`${path} must define a workflow`)
  return workflow
}

function workflowEvent(workflow: Record<string, unknown>, event: string): Record<string, unknown> {
  if (!isRecord(workflow.on) || !isRecord(workflow.on[event])) {
    throw new TypeError(`workflow must define the ${event} event`)
  }
  return workflow.on[event]
}

function workflowJob(workflow: Record<string, unknown>, job: string): Record<string, unknown> {
  if (!isRecord(workflow.jobs) || !isRecord(workflow.jobs[job])) {
    throw new TypeError(`workflow must define the ${job} job`)
  }
  return workflow.jobs[job]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function launcherMutation(name: string, mutate: (run: string) => string): readonly [string, (job: Record<string, unknown>) => void] {
  return [name, (job) => { mutateFusionLauncher(job, mutate) }]
}

function mutateFusionLauncher(job: Record<string, unknown>, mutate: (run: string) => string): void {
  const launcher = commandSteps(job).find(
    step => step.name === 'Run Fusion external-profile snapshot with system Google Chrome',
  )
  if (launcher === undefined) throw new TypeError('Fusion job must define the Chrome launcher')
  launcher.run = mutate(launcher.run)
}

function commandSteps(job: Record<string, unknown>): Array<Record<string, unknown> & { run: string }> {
  if (!Array.isArray(job.steps)) throw new TypeError('Workflow job must define steps')
  return (job.steps as unknown[]).filter((step): step is Record<string, unknown> & { run: string } => isRecord(step) && typeof step.run === 'string')
}

function replaceRequired(source: string, search: string | RegExp, replacement: string): string {
  const replaced = source.replace(search, replacement)
  if (replaced === source) throw new TypeError(`Fixture mutation did not match ${String(search)}`)
  return replaced
}

function readinessBlock(source: string): string {
  const readiness = source.match(/^\s*ready=\s*$[\s\S]*?^\s*if\s+\[\[\s+-z\s+"\$ready"\s+\]\];\s*then\s*$[\s\S]*?^\s*fi\s*$/m)?.[0]
  if (readiness === undefined) throw new TypeError('Fixture mutation did not find the readiness block')
  return readiness
}

function moveReadinessAfterAcceptance(source: string): string {
  const readiness = readinessBlock(source)
  const withoutReadiness = replaceRequired(source, readiness, '')
  return replaceRequired(withoutReadiness, 'pnpm run test:fusion:acceptance:built', `pnpm run test:fusion:acceptance:built\n${readiness}`)
}

function moveCleanupAfterAcceptance(source: string): string {
  const cleanup = source.match(/^cleanup\(\) \{\n[\s\S]*?^\}$/m)?.[0]
  if (cleanup === undefined) throw new TypeError('Fixture mutation did not find cleanup()')
  const withoutCleanup = replaceRequired(source, cleanup, '')
  return replaceRequired(
    withoutCleanup,
    'pnpm run test:fusion:acceptance:built',
    `pnpm run test:fusion:acceptance:built\n${cleanup}`,
  )
}

function writeExecutable(path: string, source: string): void {
  writeFileSync(path, source)
  chmodSync(path, 0o755)
}

function runFusionLauncherProbe(source: string): {
  acceptanceCalled: boolean
  accepted: boolean
  childExited: boolean
  childFinishedBeforeReturn: boolean
  profileRemoved: boolean
  status: number | null
} {
  const root = mkdtempSync(join(tmpdir(), 'dsh-ci-launcher-'))
  const bin = join(root, 'bin')
  const profile = join(root, 'profile')
  const ready = join(root, 'ready')
  const finished = join(root, 'finished')
  const pidFile = join(root, 'pid')
  const acceptance = join(root, 'acceptance')
  mkdirSync(bin)
  writeExecutable(join(bin, 'setsid'), `#!/usr/bin/env python3
import os
import sys

args = sys.argv[1:]
if args and args[0] == "--":
    args = args[1:]
os.setsid()
os.execv(args[0], args)
`)
  writeExecutable(join(bin, 'google-chrome'), `#!/usr/bin/env bash
set -u
trap 'sleep 0.1; printf done > "$FUSION_PROBE_FINISHED"; exit 0' TERM
printf '%s' "$$" > "$FUSION_PROBE_PID"
printf ready > "$FUSION_PROBE_READY"
while true; do
  sleep 1
done
`)
  writeExecutable(join(bin, 'curl'), `#!/usr/bin/env bash
[[ -f "$FUSION_PROBE_READY" ]]
`)
  writeExecutable(join(bin, 'mktemp'), `#!/usr/bin/env bash
set -u
mkdir -p "$FUSION_PROBE_PROFILE"
printf '%s\\n' "$FUSION_PROBE_PROFILE"
`)
  writeExecutable(join(bin, 'pnpm'), `#!/usr/bin/env bash
set -u
[[ "$*" == "run test:fusion:acceptance:built" ]]
printf called > "$FUSION_PROBE_ACCEPTANCE"
`)
  let pid: number | undefined
  try {
    const result = spawnSync('bash', ['-c', source], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FUSION_PROBE_ACCEPTANCE: acceptance,
        FUSION_PROBE_FINISHED: finished,
        FUSION_PROBE_PID: pidFile,
        FUSION_PROBE_PROFILE: profile,
        FUSION_PROBE_READY: ready,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
        RUNNER_TEMP: root,
      },
      timeout: 10_000,
    })
    if (existsSync(pidFile)) pid = Number(readFileSync(pidFile, 'utf8'))
    let childExited = false
    if (pid !== undefined) {
      try {
        process.kill(pid, 0)
      } catch {
        childExited = true
      }
    }
    const acceptanceCalled = existsSync(acceptance)
    const childFinishedBeforeReturn = existsSync(finished)
    const profileRemoved = !existsSync(profile)
    const accepted = result.status === 0
      && acceptanceCalled
      && childExited
      && childFinishedBeforeReturn
      && profileRemoved
    return {
      acceptanceCalled,
      accepted,
      childExited,
      childFinishedBeforeReturn,
      profileRemoved,
      status: result.status,
    }
  } finally {
    if (pid !== undefined && Number.isFinite(pid)) {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        // The cleanup already reaped the process group.
      }
    }
    rmSync(root, { recursive: true, force: true })
  }
}

function addUnreachableChromeDecoy(source: string): string {
  const launch = source.match(/^setsid "\$chrome_bin" \\\n(?:.*\\\n)*?.*&$/m)?.[0]
  if (launch === undefined) throw new TypeError('Fixture mutation did not find the Chrome launch')
  return replaceRequired(source, launch, `if false; then\n${launch}\nfi\n${launch.replace('setsid ', '')}`)
}

const readinessSuccess = `  if curl --silent --show-error --fail --max-time 1 \\
    http://127.0.0.1:9333/json/version >/dev/null; then
    ready=1
    break
  fi`

function moveReadinessSuccessBeforeProbe(source: string): string {
  return replaceRequired(source, readinessSuccess, `  ready=1
  break
  if curl --silent --show-error --fail --max-time 1 \\
    http://127.0.0.1:9333/json/version >/dev/null; then
  fi`)
}

function hideReadinessProbe(source: string): string {
  const readiness = readinessBlock(source)
  return replaceRequired(source, readiness, `if false; then\n${readiness.replace(/^/gm, '  ')}\nfi`)
}

function hasFusionLifecycleContract(job: Record<string, unknown>): boolean {
  const launcher = commandSteps(job).find(
    step => step.name === 'Run Fusion external-profile snapshot with system Google Chrome',
  )
  const timeoutMinutes = job['timeout-minutes']
  if (
    launcher === undefined
    || typeof timeoutMinutes !== 'number'
    || timeoutMinutes * 60_000 <= FUSION_ACCEPTANCE_TIMEOUT_MS
    || timeoutMinutes * 60_000 - FUSION_ACCEPTANCE_TIMEOUT_MS < FUSION_CI_RESERVE_MS
  ) return false

  const lines = executableLines(launcher.run)
  const acceptance = lines.indexOf('pnpm run test:fusion:acceptance:built')
  const chromeVariable = assignedVariable(lines, /^"?\$\(\s*command\s+-v\s+google-chrome\s*\)"?$/)
  const profileVariable = assignedVariable(lines, /^"?\$\(\s*mktemp\s+-d\s*\)"?$/)
  const pidVariable = assignedVariable(lines, /^\$!$/)
  if (
    acceptance < 0
    || chromeVariable === undefined
    || profileVariable === undefined
    || pidVariable === undefined
  ) return false

  const chromeReference = `"?\\$${chromeVariable}"?`
  const pidReference = `"?-?\\$${pidVariable}"?`
  const profileAssignment = lines.findIndex(line =>
    new RegExp(`^${profileVariable}="?\\$\\(\\s*mktemp\\s+-d\\s*\\)"?$`).test(line))
  const pidAssignment = lines.findIndex(line =>
    new RegExp(`^${pidVariable}=\\$!$`).test(line))
  const launchPattern = new RegExp(`^(?:setsid\\s+(?:--\\s+)?)?${chromeReference}\\s+.*--remote-debugging-port(?:=|\\s+)9333(?:\\s|$)`)
  const launchIndexes = lines.flatMap((line, index) => launchPattern.test(line) ? [index] : [])
  const launch = launchIndexes[0] ?? -1
  const startsWithSetsid = new RegExp(`^setsid\\s+(?:--\\s+)?${chromeReference}\\s+`).test(lines[launch] ?? '')
  const usesProfile = new RegExp(`(?:^|\\s)--user-data-dir="?\\$${profileVariable}"?(?:\\s|$)`).test(lines[launch] ?? '')

  const traps = lines.flatMap((line, index) => /\bEXIT$/.test(line) && line.startsWith('trap ') ? [[line, index] as const] : [])
  const finalTrap = traps.at(-1)
  const trapIsEffective = finalTrap?.[0] === 'trap cleanup EXIT'
    && finalTrap[1] < acceptance
    && !traps.some(([line]) => line === 'trap - EXIT')

  const cleanupStart = lines.indexOf('cleanup() {')
  const cleanupEnd = lines.indexOf('}', cleanupStart + 1)
  const cleanup = lines.slice(cleanupStart + 1, cleanupEnd)
  const pidGuard = cleanup.indexOf(`if [[ -n "$${pidVariable}" ]]; then`)
  const term = cleanup.findIndex(line =>
    new RegExp(`^kill\\s+-TERM\\s+--\\s+"?-\\$${pidVariable}"?\\s+2>\\/dev\\/null\\s+\\|\\|\\s+true$`).test(line))
  const pollStart = cleanup.findIndex(line => /^for\s+[A-Za-z_]\w*\s+in\s+\{1\.\.[1-9]\d*\};\s*do$/u.test(line))
  const pollEnd = cleanup.indexOf('done', pollStart + 1)
  const pollChecksPid = cleanup.slice(pollStart + 1, pollEnd).some(line =>
    new RegExp(`^kill\\s+-0\\s+${pidReference}\\s+2>\\/dev\\/null\\s+\\|\\|\\s+break$`).test(line))
  const pollSleeps = cleanup.slice(pollStart + 1, pollEnd).some(line =>
    /^sleep\s+(?:\d+(?:\.\d+)?|\.\d+)$/u.test(line))
  const kill = cleanup.findIndex(line =>
    new RegExp(`^kill\\s+-KILL\\s+--\\s+"?-\\$${pidVariable}"?\\s+2>\\/dev\\/null\\s+\\|\\|\\s+true$`).test(line))
  const wait = cleanup.findIndex(line =>
    new RegExp(`^wait\\s+"?\\$${pidVariable}"?\\s+2>\\/dev\\/null\\s+\\|\\|\\s+true$`).test(line))
  const pidGuardEnd = cleanup.indexOf('fi', wait + 1)
  const profileGuard = cleanup.indexOf(`if [[ -n "$${profileVariable}" ]]; then`, pidGuardEnd + 1)
  const removesProfile = cleanup.findIndex(line =>
    new RegExp(`^rm\\s+-rf\\s+(?:--\\s+)?"?\\$${profileVariable}"?$`).test(line))
  const profileGuardEnd = cleanup.indexOf('fi', removesProfile + 1)
  const returnsBeforeCleanup = cleanup.some(line => /\breturn(?:\s|$)/u.test(line))

  return launchIndexes.length === 1
    && launch < acceptance
    && startsWithSetsid
    && usesProfile
    && trapIsEffective
    && cleanupStart >= 0
    && cleanupEnd > cleanupStart
    && !returnsBeforeCleanup
    && cleanupEnd < finalTrap[1]
    && finalTrap[1] < profileAssignment
    && profileAssignment < launch
    && launch < pidAssignment
    && pidAssignment < acceptance
    && pidGuard >= 0
    && pidGuard < term
    && term < pollStart
    && pollStart < pollEnd
    && pollChecksPid
    && pollSleeps
    && pollEnd < kill
    && kill < wait
    && wait < pidGuardEnd
    && pidGuardEnd < profileGuard
    && profileGuard < removesProfile
    && removesProfile < profileGuardEnd
    && hasReadinessBeforeAcceptance(lines, acceptance)
}

function hasReadinessBeforeAcceptance(lines: string[], acceptance: number): boolean {
  const probePattern = /^if curl\b(?=.*\s--fail(?:\s|$))(?=.*http:\/\/127\.0\.0\.1:9333\/json\/version\b).*;\s*then$/
  const probes = lines.flatMap((line, index) => probePattern.test(line) ? [index] : [])
  const probe = probes[0] ?? -1
  const loop = lines.lastIndexOf('for _ in {1..40}; do', probe)
  const done = lines.indexOf('done', probe)
  const guard = lines.indexOf('if [[ -z "$ready" ]]; then', done + 1)
  const failure = lines.indexOf('exit 1', guard + 1)
  const guardEnd = lines.indexOf('fi', guard + 1)
  return probes.length === 1
    && lines.lastIndexOf('ready=', loop) >= 0
    && loop < probe
    && !lines.includes('if false; then')
    && lines[probe + 1] === 'ready=1'
    && lines[probe + 2] === 'break'
    && lines[probe + 3] === 'fi'
    && done > probe
    && guard > done
    && failure > guard
    && failure < guardEnd
    && guardEnd < acceptance
}

function executableLines(source: string): string[] {
  return source
    .replace(/\\\r?\n\s*/g, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+#.*$/, '').trim())
    .filter(line => line !== '' && !line.startsWith('#') && !/^(?:echo|printf)\b/.test(line))
}

function assignedVariable(lines: string[], value: RegExp): string | undefined {
  for (const line of lines) {
    const assignment = line.match(/^([A-Za-z_]\w*)=(.+)$/)
    if (assignment !== null && value.test(assignment[2] ?? '')) return assignment[1]
  }
}
