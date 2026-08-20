# `@deepseek-ai/dsh-fusion`

[English](README.md) | 中文

fusion profile 在 [`dsh-base`](../base/README.md) 与 [`dsh-web-app`](../web-app/README.md) 之后应用的静态 patch 层。manifest 的 `dsh.bundle.profileDependencies` 把 [`cordis.patch.yml`](cordis.patch.yml) 直接引用且由 profile 持有的每个裸包映射到精确版本。该 metadata 只记录静态所有权：使用方必须在启动前把这些包安装到同一个 profile，运行时既不读取该字段，也不安装包。缺少任何包都会由 Loader 的常规解析明确报错。该包没有运行时 API，也没有第三方运行时依赖。

## 模型体验

通过 fusion patch 插入的行间接产生影响；每个插入包负责自身面向模型的行为。

#### KV Cache 影响

无直接影响；每个插入包负责自身的影响。

## 已知限制与暂缓事项

- **该组合包不是内置 profile 模板**：使用方需要显式组合 `base`、`web-app` 与 `fusion`，并把 `dsh.bundle.profileDependencies` 中的每个包安装到该 profile。
- **外部版本由 profile 持有**：该 metadata 不是安装配方；peer provider 与 profile 局部构建许可仍由使用方负责，dsh 或外部包发生变化时必须重新运行兼容矩阵。
- **桌面集成是一项消费约定**：该包不会修改或交付外部 Electron 应用。
