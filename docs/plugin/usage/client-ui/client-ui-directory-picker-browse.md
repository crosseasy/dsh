# client-ui-directory-picker-browse 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-directory-picker-browse` 提供 Web 内目录浏览入口，用于配合 host 侧目录列表和创建能力。

## 适用场景

- 用户需要在设置或工作区流程中从 Web 页面选择目录。
- 排查 browse provider 的 UI 入口是否存在。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-directory-picker-browse/src/index.ts:10; docs/config-catalog.md`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 点击“设置”。
3. 确认设置页存在“打开配置文件”入口，该入口关联目录或文件打开能力。

## 可观察结果

设置面板显示“打开配置文件”入口；设置页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-directory-picker-browse` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-directory-picker-browse.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“设置面板显示“打开配置文件”入口，与目录/文件打开类 host 能力共享入口相关。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-general.png](../_assets/client-ui/settings-general.png)。
- 证据编号：E5；E6；console/network 结论：设置页 clean。

## 限制与故障排查

本轮没有打开 browse picker，也没有创建目录。若 browse picker 不出现，先核对 config catalog 中 provider 选择，再检查 host directory picker 能力。

Task 3 对该插件记录的限制是：未打开 browse picker。
