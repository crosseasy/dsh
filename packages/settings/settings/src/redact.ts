/**
 * Fail-closed Settings wire descriptions. Supported schemas are inspected
 * before any value or schema metadata is serialized; secrets are removed from
 * every value layer and from schema defaults.
 * @module @deepseek-ai/dsh-settings/redact
 */

import type z from '@deepseek-ai/schemastery'

/** Structural fields used to prove and serialize one live Schemastery graph. */
interface SchemaNode {
  uid?: number
  type?: string
  meta?: { role?: unknown; default?: unknown }
  /** `object` properties, keyed by property name. */
  dict?: Record<string, SchemaNode>
  /** `dict`/`array` element schema. */
  inner?: SchemaNode
  /** `union`/`intersect` member schemas. */
  list?: SchemaNode[]
  /** `dict` key schema. */
  sKey?: SchemaNode
  toJSON?: () => unknown
}

/** One schema-declared secret position inside a redacted value. */
export interface RedactedSecret {
  /** Path from the section root to the removed field (concrete dict keys and array indexes included). */
  path: string[]
  /** Whether the field held a value before redaction. */
  set: boolean
}

/** A value with every `role('secret')` field removed, plus the removal record. */
export interface RedactedValue {
  /** Detached copy of the input with secret fields absent. */
  value: unknown
  /**
   * Every reachable secret position: object properties always (even unset, so
   * a form knows the slot exists), dict entries and array items only where the
   * value has them.
   */
  secrets: RedactedSecret[]
}

/** Inputs whose values and schema metadata form one wire description. */
export interface WireDescriptionInput {
  /** Current resolved value. */
  value: unknown
  /** Composition base layer, when declared. */
  base?: unknown
  /** Raw user layer, when present. */
  user?: unknown
}

/** Schema and value layers proven safe to send to a settings client. */
export interface WireDescription extends WireDescriptionInput {
  /** Callback-free serialized Schemastery envelope with secret defaults removed. */
  schema: unknown
  /** Schema-declared secret positions in the resolved value. */
  secrets: RedactedSecret[]
}

const WIRE_SCHEMA_ERROR = 'settings schema cannot be represented safely on the wire'
const LEAF_TYPES = new Set(['bitset', 'boolean', 'const', 'never', 'number', 'string'])

/** Whether a value is a plain data object the walker may recurse into. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject without naming schema metadata or values that may contain secrets. */
function unsafeSchema(): never {
  throw new TypeError(WIRE_SCHEMA_ERROR)
}

/** Prove the graph traversable and report whether this subtree declares a secret. */
function inspectSchema(
  node: unknown,
  visiting: Set<SchemaNode>,
  inspected: Map<SchemaNode, boolean>,
  nodesByUid: Map<number, SchemaNode>,
): boolean {
  if ((typeof node !== 'object' && typeof node !== 'function') || node === null) unsafeSchema()
  const schemaNode = node as SchemaNode
  const cached = inspected.get(schemaNode)
  if (cached !== undefined) return cached
  if (visiting.has(schemaNode)) unsafeSchema()
  if (!Number.isInteger(schemaNode.uid) || schemaNode.type === undefined) unsafeSchema()
  const prior = nodesByUid.get(schemaNode.uid as number)
  if (prior !== undefined && prior !== schemaNode) unsafeSchema()
  nodesByUid.set(schemaNode.uid as number, schemaNode)
  visiting.add(schemaNode)

  const selfSecret = schemaNode.meta?.role === 'secret'
  let descendantSecret = false
  if (LEAF_TYPES.has(schemaNode.type)) {
    // Leaf metadata alone determines whether the value is secret.
  } else if (schemaNode.type === 'object') {
    if (!isRecord(schemaNode.dict)) unsafeSchema()
    for (const child of Object.values(schemaNode.dict)) {
      if (inspectSchema(child, visiting, inspected, nodesByUid)) descendantSecret = true
    }
  } else if (schemaNode.type === 'dict') {
    if (schemaNode.inner === undefined || schemaNode.sKey === undefined) unsafeSchema()
    const keySecret = inspectSchema(schemaNode.sKey, visiting, inspected, nodesByUid)
    if (keySecret) unsafeSchema()
    descendantSecret = inspectSchema(schemaNode.inner, visiting, inspected, nodesByUid)
  } else if (schemaNode.type === 'array') {
    if (schemaNode.inner === undefined) unsafeSchema()
    descendantSecret = inspectSchema(schemaNode.inner, visiting, inspected, nodesByUid)
  } else if (schemaNode.type === 'union' || schemaNode.type === 'intersect') {
    if (!Array.isArray(schemaNode.list)) unsafeSchema()
    for (const child of schemaNode.list) {
      if (inspectSchema(child, visiting, inspected, nodesByUid)) descendantSecret = true
    }
    if (selfSecret || descendantSecret) unsafeSchema()
  } else {
    // Transform/lazy/function/is/any/tuple and extension-defined nodes cannot
    // be proven callback-free and structurally redactable.
    unsafeSchema()
  }

  visiting.delete(schemaNode)
  const containsSecret = selfSecret || descendantSecret
  inspected.set(schemaNode, containsSecret)
  return containsSecret
}

function walk(node: SchemaNode, value: unknown, path: string[], secrets: RedactedSecret[]): unknown {
  if (node.meta?.role === 'secret') {
    secrets.push({ path, set: value !== undefined })
    return undefined
  }
  switch (node.type) {
    case 'object': {
      const properties = node.dict ?? {}
      const source = isRecord(value) ? value : undefined
      const rebuilt: Record<string, unknown> = {}
      if (source !== undefined) {
        for (const [key, entry] of Object.entries(source)) {
          if (key in properties) continue
          rebuilt[key] = entry
        }
      }
      for (const [key, child] of Object.entries(properties)) {
        const stripped = walk(child, source?.[key], [...path, key], secrets)
        if (stripped !== undefined) rebuilt[key] = stripped
      }
      return source === undefined && Object.keys(rebuilt).length === 0 ? value : rebuilt
    }
    case 'dict': {
      if (!isRecord(value)) return value
      const rebuilt: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(value)) {
        const stripped = walk(node.inner as SchemaNode, entry, [...path, key], secrets)
        if (stripped !== undefined) rebuilt[key] = stripped
      }
      return rebuilt
    }
    case 'array': {
      if (!Array.isArray(value)) return value
      return value.map((entry, index) =>
        walk(node.inner as SchemaNode, entry, [...path, String(index)], secrets))
    }
    default:
      return value
  }
}

/** Redact one value after the schema graph has passed inspection. */
function redactValue(schema: SchemaNode, value: unknown): RedactedValue {
  const secrets: RedactedSecret[] = []
  const stripped = walk(schema, value, [], secrets)
  return { value: stripped, secrets }
}

/**
 * Remove every `role('secret')` field a schema declares from a value. The
 * walker follows proven `object`, `dict`, and `array` containers. A secret
 * under a union or intersection and every transform or unknown node rejects
 * with a value-free error. The input is never mutated.
 * @param schema - live schemastery schema describing the value.
 * @param value - value to strip.
 * @returns the stripped detached value and the ordered secret positions.
 */
export function redactSecrets(schema: z<never>, value: unknown): RedactedValue {
  inspectSchema(schema, new Set(), new Map(), new Map())
  return redactValue(schema, value)
}

/**
 * Produce one Settings wire description after proving the complete live
 * schema graph safe. Secret values are removed from every layer and every
 * schema default; transforms and ambiguous secret paths reject before
 * serialization with a value-free error.
 * @param schema - live Schemastery schema describing every value layer.
 * @param layers - resolved, composition, and user values to describe.
 * @returns callback-free schema metadata, redacted layers, and secret slots.
 */
export function describeForWire(schema: z<never>, layers: WireDescriptionInput): WireDescription {
  const nodesByUid = new Map<number, SchemaNode>()
  inspectSchema(schema, new Set(), new Map(), nodesByUid)

  let serialized: unknown
  try {
    serialized = schema.toJSON()
  } catch {
    unsafeSchema()
  }
  if (!isRecord(serialized) || !isRecord(serialized['refs'])) unsafeSchema()
  for (const [uid, node] of nodesByUid) {
    const encoded = serialized['refs'][String(uid)]
    if (!isRecord(encoded) || !isRecord(encoded['meta'])) unsafeSchema()
    if ('callback' in encoded || 'builder' in encoded) unsafeSchema()
    if (!('default' in encoded['meta'])) continue
    const redactedDefault = redactValue(node, node.meta?.default).value
    if (redactedDefault === undefined) {
      Reflect.deleteProperty(encoded['meta'], 'default')
    } else {
      encoded['meta']['default'] = redactedDefault
    }
  }

  const resolved = redactValue(schema, layers.value)
  const base = layers.base === undefined ? undefined : redactValue(schema, layers.base).value
  const user = layers.user === undefined ? undefined : redactValue(schema, layers.user).value
  return {
    schema: serialized,
    value: resolved.value,
    ...base === undefined ? {} : { base },
    ...user === undefined ? {} : { user },
    secrets: resolved.secrets,
  }
}
