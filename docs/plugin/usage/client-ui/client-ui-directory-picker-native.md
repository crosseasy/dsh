# client-ui-directory-picker-native 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-directory-picker-native` 提供 renderless 的原生目录选择入口，用于驱动 host 侧操作系统选择器。

## 适用场景

- 用户需要从 Web 设置流程调用操作系统目录选择。
- 排查 native picker provider 是否被客户端入口识别。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-directory-picker-native/src/index.ts:10; docs/config-catalog.md`。

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

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-directory-picker-native` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-directory-picker-native.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“设置面板显示“打开配置文件”入口，与 native picker 共享入口相关。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-general.png](../_assets/client-ui/settings-general.png)。
- 证据编号：E5；E6；console/network 结论：设置页 clean。

## 限制与故障排查

本轮没有打开 native picker，避免产生系统 UI 副作用。若 native picker 不工作，先确认当前 profile 选择了 native provider。

Task 3 对该插件记录的限制是：未打开 native picker。
