# `@deepseek-ai/dsh-curated-base`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-base` is a static profile bundle for the curated plugin layer. Its `dsh.bundle.patch` manifest points to [`cordis.patch.yml`](cordis.patch.yml), which inserts the `@deepseek-ai/dsh-curated-policy` and `@deepseek-ai/dsh-curated-bench` rows. Third-party plugin rows belong to other curated bundles or profile overlays.

## Bundle Contract

The package exports no runtime API from its main module. Its package manifest declares the bundle patch consumed by profile composition, and the optional invariant companion records that the bundle carries no runtime invariant beyond loading the curated service rows.

## Model Experience

### Curated service insertion

#### What the model sees

The bundle patch inserts the `@deepseek-ai/dsh-curated-policy` and `@deepseek-ai/dsh-curated-bench` Cordis rows and contributes no prompt text, tool schema, user message, assistant-visible result, or session event of its own.

#### Token effect

Zero direct token cost.

#### KV Cache effect

None directly; the inserted curated packages own any cache-relevant context they register.

## Known Limitations and Deferred Work

- **Curated behavior is delegated**: this bundle loads only `@deepseek-ai/dsh-curated-policy` and `@deepseek-ai/dsh-curated-bench`; plugin allowlists, benchmark assets, enforcement, and third-party rows belong to those packages or other bundles.
- **No candidate installation**: the bundle does not install third-party packages or run their install lifecycle scripts.
