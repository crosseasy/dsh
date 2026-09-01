# Reverify Browser Settings CDP

Status: PASS

## Scope

Revalidated the real Settings UI path from the overlay/plugin registration into the browser Plugins settings card, using external Google Chrome over CDP at `127.0.0.1:9333`. The run intentionally left first-run onboarding pending and handled it after the real page loaded.

## Inputs Read

- `.trae/specs/execute-code-optimization-audit/spec.md`
- `.trae/specs/execute-code-optimization-audit/tasks.md`
- `.trae/specs/execute-code-optimization-audit/checklist.md`
- `.trae/specs/execute-code-optimization-audit/reports/browser-settings-cdp.md`
- `/Users/bytedance/.trae-cn/skills/browser-aio/SKILL.md`
- `/Users/bytedance/.trae-cn/skills/browser-aio/references/chrome-devtools-cli.md`

## Command Discipline

All shell commands in this reverify run were wrapped with `gtimeout 55s`. No `git commit`, `git push`, `git merge`, `git rebase`, or `git reset` command was run.

## Build/Serve Path

Artifacts were refreshed before the browser pass:

- `gtimeout 55s pnpm --config.verify-deps-before-run=false run build:lib:client`
- `gtimeout 55s pnpm --config.verify-deps-before-run=false run build:web`

The browser pass used a single 55-second bounded Node controller that started the built app command internally and cleaned it up:

- `node apps/cli/lib/bin.js web --no-open --port 0`

Served URL:

`http://127.0.0.1:58994`

## CDP Target

Endpoint:

`http://127.0.0.1:9333`

Browser:

```json
{
  "Browser": "Chrome/151.0.7922.174",
  "Protocol-Version": "1.3",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
}
```

Target used:

```json
{
  "id": "D9DBAADAF33FF2DC9B8835308096DB20",
  "type": "page",
  "title": "DSH Local Build",
  "url": "http://127.0.0.1:58994/"
}
```

The target was closed by the verification script after capture.

## Browser Actions

- Loaded the real page through CDP.
- Detected first-run onboarding after page load.
- Clicked `继续`.
- Clicked `稍后配置`.
- Clicked `设置`.
- Clicked the `插件` settings section.
- Confirmed `插件配置` tab content.
- Confirmed configurable plugin cards for `终端`, `Agent 循环`, and `网页搜索`.
- Expanded the `终端` card and confirmed schema-backed fields:
  - `#plugin-config-bash-timeout` / `命令超时（毫秒）`, value `60000`
  - `#plugin-config-bash-output` / `单流输出上限（字节）`, value `64000`

## Console Verdict

PASS: no browser console warnings or errors were observed.

Captured CDP problem streams:

```json
{
  "warnings": [],
  "errors": [],
  "eventCount": 1
}
```

## Screenshot

`/Users/bytedance/opencode/agent/dsh/.trae/specs/execute-code-optimization-audit/reports/reverify-browser-settings-cdp.png`

The screenshot is a `1680 x 1000` PNG.

## Cleanup

The verification script terminated its owned Web child process and removed its temporary harness home. A stale orphaned `pnpm dsh web --no-open --port 0` process from an older run was found, verified as listening under this repository, and terminated. A final process scan found no matching `dsh web` process.

Existing Chrome targets for previously dead localhost pages remained in the user's external Chrome profile; they were not used by this run.

## Failures

None for the product verification. Two script-only retries occurred before the passing run:

- First retry failed during Node script parsing because of nested template-string interpolation.
- Second retry reached the Plugins page but used an over-strict wait for an ARIA label that is not exposed through `innerText`.

Both were corrected before the final passing CDP run above.
