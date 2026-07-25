import { defaultValueForType } from './miliastra.js'

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function referencedStructId(field) {
  return field?.value?.structId == null ? '' : String(field.value.structId)
}

/**
 * Convert a nested fixed-size Struct definition into leaf columns.
 * Variable-size containers (StructList/Dict/lists) remain leaf columns.
 */
export function flattenStructDefinition(definition, resolveDefinition) {
  if (!definition) return []

  function visit(fields, prefix, path, seen) {
    const columns = []
    fields.forEach((field, index) => {
      const fieldPath = [...path, index]
      const label = prefix ? `${prefix}.${field.key}` : field.key

      if (field.paramType === 'Struct') {
        const structId = referencedStructId(field)
        const nested = resolveDefinition(structId)
        if (nested && !seen.has(structId)) {
          columns.push(
            ...visit(nested.fields, label, fieldPath, new Set([...seen, structId]))
          )
          return
        }
      }

      columns.push({
        id: fieldPath.join('.'),
        label,
        group: prefix,
        leaf: field.key,
        path: fieldPath,
        paramType: field.paramType
      })
    })
    return columns
  }

  return visit(
    definition.fields ?? [],
    '',
    [],
    new Set([String(definition.structId ?? '')])
  )
}

/** Group adjacent flattened columns that share the same parent Struct path. */
export function groupFlattenedColumns(columns) {
  const groups = []
  let index = 0
  while (index < columns.length) {
    const group = columns[index].group
    if (!group) {
      groups.push({ group: '', columns: [columns[index]] })
      index++
      continue
    }

    let end = index
    while (end < columns.length && columns[end].group === group) end++
    groups.push({ group, columns: columns.slice(index, end) })
    index = end
  }
  return groups
}

/** Read the leaf `{ param_type, value }` from a Struct value by positional path. */
export function getStructEntryAtPath(structValue, path) {
  let node = structValue
  for (let depth = 0; depth < path.length; depth++) {
    if (!node || !Array.isArray(node.value)) return null
    const entry = node.value[path[depth]]
    if (!entry) return null
    if (depth === path.length - 1) return entry
    node = entry.value
  }
  return null
}

/** Write a leaf value while preserving the original Miliastra wrapper objects. */
export function setStructValueAtPath(structValue, path, value) {
  const entry = getStructEntryAtPath(structValue, path)
  if (!entry) return false
  entry.value = value
  return true
}

/** Build a complete default Struct value, recursively expanding fixed Struct fields. */
export function createBlankStructValue(definition, resolveDefinition, seen = new Set()) {
  if (!definition) return { structId: '', type: 'Struct', value: [] }
  const definitionId = String(definition.structId ?? '')
  const nextSeen = new Set([...seen, definitionId])

  return {
    structId: definitionId,
    type: 'Struct',
    value: (definition.fields ?? []).map((field) => {
      if (field.paramType === 'Struct') {
        const structId = referencedStructId(field)
        const nested = resolveDefinition(structId)
        const value = nested && !nextSeen.has(structId)
          ? createBlankStructValue(nested, resolveDefinition, nextSeen)
          : { structId, type: 'Struct', value: [] }
        return { param_type: 'Struct', value }
      }

      if (field.paramType === 'StructList') {
        return {
          param_type: 'StructList',
          value: { structId: referencedStructId(field), value: [] }
        }
      }

      const value = field.paramType === 'Dict'
        ? cloneValue(field.value)
        : cloneValue(defaultValueForType(field.paramType))
      return { param_type: field.paramType, value }
    })
  }
}
