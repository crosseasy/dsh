// An out-of-tree plugin crosses the real Web composition twice: its Host half
// registers a Settings namespace and its dsh.client half registers the keyed
// card that renders only when that namespace reaches the browser.
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  launchWebScaffold, watchConsole, type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, saveFailureShot } from './support.ts'

const OVERLAY = fileURLToPath(new URL('./plugin-config-overlay.overlay.yml', import.meta.url))
const FIXTURE_PACKAGE = fileURLToPath(new URL('./fixtures/plugin-config-overlay', import.meta.url))
const FIXTURE_PACKAGE_NAME = '@dsh-test/plugin-config-overlay'

describe('web e2e: overlay plugin configuration', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      extraOverlayPath: OVERLAY,
      fixturePackages: [{ name: FIXTURE_PACKAGE_NAME, sourceDir: FIXTURE_PACKAGE }],
    })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    const failures: unknown[] = []
    await browser?.close().catch((error: unknown) => { failures.push(error) })
    await scaffold?.close().catch((error: unknown) => { failures.push(error) })
    if (failures.length > 0) throw new AggregateError(failures, 'overlay settings test teardown failed')
  })

  it('joins the Host namespace to its browser card without exposing its secret', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-plugin-config-overlay'))
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '插件', exact: true }).click()
    const card = dialog.locator('[data-overlay-settings-card]')
    await card.waitFor({ timeout: 10_000 })
    expect(await card.textContent()).toBe('Overlay settings')

    const wire = await page.evaluate(async () => {
      const rpcId = crypto.randomUUID()
      const response = await fetch('/api/settings.describe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId,
          method: 'settings.describe',
          payload: {},
        }),
      })
      return await response.json() as unknown
    }) as {
      result: {
        ok: boolean
        value?: {
          namespaces: {
            ns: string
            schema: unknown
            value: unknown
            secrets: { path: string[]; set: boolean }[]
          }[]
        }
      }
    }
    expect(wire.result.ok).toBe(true)
    const namespace = wire.result.value?.namespaces
      .find(candidate => candidate.ns === 'overlay-fixture')
    expect(namespace).toMatchObject({
      ns: 'overlay-fixture',
      value: { label: 'Overlay settings' },
      secrets: [{ path: ['token'], set: true }],
    })
    const serialized = JSON.stringify(namespace)
    expect(serialized).not.toContain('fixture-secret-default')
    expect(serialized).not.toContain('fixture-secret-value')
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 60_000)
})
