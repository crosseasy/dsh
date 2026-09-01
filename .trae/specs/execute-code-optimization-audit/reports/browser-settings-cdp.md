# Browser Settings CDP Verification

Status: FAIL

## Scope

Validate the real Web assembly path from Settings UI overlay/plugin registration to the browser Settings card, using external Google Chrome over CDP on `127.0.0.1:9333`, and confirm the loaded page has no console errors or warnings.

## Command Discipline

All shell commands in this run were wrapped with `gtimeout 55s`. No long-running command is still active. No `git commit`, `git push`, `git merge`, `git rebase`, or `git reset` command was run.

## Inputs Read

- `.trae/specs/execute-code-optimization-audit/spec.md`
- `.trae/specs/execute-code-optimization-audit/tasks.md`
- `.trae/specs/execute-code-optimization-audit/checklist.md`
- `/Users/bytedance/.trae-cn/skills/browser-aio/SKILL.md`
- Browser AIO CDP references used for raw CDP transport.

## CDP Probe

Endpoint: `http://127.0.0.1:9333`

Result: reused existing external Google Chrome endpoint.

Browser:

```json
{
  "Browser": "Chrome/151.0.7922.174",
  "Protocol-Version": "1.3",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
}
```

Existing target inventory included `DSH Local Build` at `http://127.0.0.1:58721/`, but that service refused connections during HTTP verification, so it was not reused as a valid page.

## Commands Run

- `gtimeout 55s cat .../spec.md`
- `gtimeout 55s cat .../tasks.md`
- `gtimeout 55s cat .../checklist.md`
- `gtimeout 55s cat /Users/bytedance/.trae-cn/skills/browser-aio/SKILL.md`
- `gtimeout 55s curl -sfm 2 http://127.0.0.1:9333/json/version`
- `gtimeout 55s curl -sfm 2 http://127.0.0.1:9333/json/list`
- `gtimeout 55s env ... pnpm dsh web --no-open --port 0`
  - Failed before serving because pnpm attempted dependency status/install and `postinstall` refused to overwrite `.git/dsh-hooks`.
- `gtimeout 55s env ... node --import tsx/esm apps/cli/src/bin.ts web --no-open --port 0`
  - Failed before serving because 41 client `lib/client.js` bundles were missing.
- `gtimeout 55s pnpm run build:lib:client`
  - Failed for the same pnpm dependency status/install hook refusal.
- `gtimeout 55s pnpm --config.verify-deps-before-run=false run build:lib:client`
  - Passed; generated client bundles.
- `gtimeout 55s pnpm --config.verify-deps-before-run=false run build:web`
  - Passed; rebuilt `apps/web/dist`.
- `gtimeout 55s env ... pnpm --config.verify-deps-before-run=false run dsh -- web --no-open --port 0`
  - Served `http://127.0.0.1:56149`, but the process was terminated by the 55s wrapper before the later CDP navigation.
- `gtimeout 55s env BASE_URL=http://127.0.0.1:56149 ... node --input-type=module`
  - Failed with `ERR_CONNECTION_REFUSED` because the server from the previous command had already exited.
- `gtimeout 55s env CDP=http://127.0.0.1:9333 ... node --input-type=module`
  - Started `apps/cli/lib/bin.js web --no-open --port 0`, observed `dsh web: http://127.0.0.1:56468`, created a CDP target, navigated to the page, and observed the DSH UI boot.
  - Failed before plugin-card verification because the onboarding dialog remained active:

```text
settings dialog not observed; last={"ok":false,"text":"内测声明 ... 继续"}
```

## Page URL

Final attempted URL: `http://127.0.0.1:56468`

The process was closed by the combined verification script after the failed assertion.

## Console Result

No passing console verdict was produced. The CDP script installed `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, and `Log.entryAdded` listeners before navigation, but the run aborted at the onboarding-blocked Settings dialog assertion before emitting the final console summary. Therefore the requirement "console has no error/warning" is unverified.

## Screenshot

No screenshot was written. Expected path was:

`/Users/bytedance/opencode/agent/dsh/.trae/specs/execute-code-optimization-audit/reports/browser-settings-cdp.png`

## Failure Summary

The browser/CDP endpoint was valid and the real Web runner could boot after rebuilding client and Web artifacts. The Settings UI validation did not reach the Plugins settings card because the first-run onboarding dialog stayed open, leaving the script waiting for the Settings dialog while the active dialog text was the onboarding notice. The overlay plugin to browser settings card path and clean-console condition are not verified.
