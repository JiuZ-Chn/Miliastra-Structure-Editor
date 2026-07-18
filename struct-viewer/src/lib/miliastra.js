/**
 * 千星奇域 结构体 / 结构体变量 转换核心库
 *
 * 数据模型（依据实际样例 简单结构体 / 复杂结构体 / 复杂结构体变量）：
 *
 * 结构体（Struct Definition，带字段名与类型的“模板/schema”）：
 * {
 *   "type": "Struct",
 *   "struct_ype": "basic",         // 样例原文如此拼写，保留以保持还原度
 *   "name": "复杂结构体",
 *   "value": [
 *     { "key": "整数变量", "param_type": "Int32",
 *       "value": { "param_type": "Int32", "value": "0" } },
 *     ...
 *   ]
 * }
 *
 * 结构体变量（Struct Variable，按位置排列的“实例值”，无字段名）：
 * {
 *   "structId": "1077936129",
 *   "type": "Struct",
 *   "value": [
 *     { "param_type": "Int32", "value": "0" },
 *     ...
 *   ]
 * }
 */

/**
 * 千星支持的全部参数类型元数据（单一数据源）。
 * kind: scalar | bool | vector3 | list | struct | structList | dict
 * title: 中文显示名；color/background: UI 徽标配色；scalarDefault: 标量默认值
 */
export const PARAM_TYPE_META = {
  String: { kind: 'scalar', title: '字符串', color: '#1E40AF', background: '#DBEAFE', scalarDefault: '' },
  StringList: { kind: 'list', title: '字符串列表', color: '#3730A3', background: '#E0E7FF' },
  Int32: { kind: 'scalar', title: '整数', color: '#166534', background: '#DCFCE7', scalarDefault: '0' },
  Int32List: { kind: 'list', title: '整数列表', color: '#065F46', background: '#D1FAE5' },
  Float: { kind: 'scalar', title: '浮点数', color: '#854D0E', background: '#FEF9C3', scalarDefault: '0.00' },
  FloatList: { kind: 'list', title: '浮点数列表', color: '#9A3412', background: '#FFEDD5' },
  Bool: { kind: 'bool', title: '布尔值', color: '#6B21A8', background: '#F3E8FF', scalarDefault: 'False' },
  BoolList: { kind: 'list', title: '布尔值列表', color: '#9D174D', background: '#FCE7F3' },
  Vector3: { kind: 'vector3', title: '三维向量', color: '#991B1B', background: '#FEE2E2', scalarDefault: '0,0,0' },
  Vector3List: { kind: 'list', title: '三维向量列表', color: '#9F1239', background: '#FFE4E6' },
  Entity: { kind: 'scalar', title: '实体', color: '#155E75', background: '#CFFAFE', scalarDefault: '0' },
  EntityList: { kind: 'list', title: '实体列表', color: '#115E59', background: '#CCFBF1' },
  Guid: { kind: 'scalar', title: 'Guid', color: '#1E293B', background: '#F1F5F9', scalarDefault: '0' },
  GuidList: { kind: 'list', title: 'Guid列表', color: '#1E293B', background: '#F1F5F9' },
  ConfigReference: { kind: 'scalar', title: '配置ID', color: '#6B21A8', background: '#F3E8FF', scalarDefault: '0' },
  ConfigReferenceList: { kind: 'list', title: '配置ID列表', color: '#9D174D', background: '#FCE7F3' },
  EntityReference: { kind: 'scalar', title: '元件ID', color: '#9F1239', background: '#FFE4E6', scalarDefault: '0' },
  EntityReferenceList: { kind: 'list', title: '元件ID列表', color: '#155E75', background: '#CFFAFE' },
  Army: { kind: 'scalar', title: '阵营', color: '#3F6212', background: '#ECFCCB', scalarDefault: '0' },
  ArmyList: { kind: 'list', title: '阵营列表', color: '#065F46', background: '#D1FAE5' },
  Struct: { kind: 'struct', title: '结构体', color: '#6A5ACD', background: '#E6E6FA' },
  StructList: { kind: 'structList', title: '结构体列表', color: '#6A5ACD', background: '#E6E6FA' },
  Dict: { kind: 'dict', title: '字典', color: '#B8860B', background: '#FFFACD' }
}

/** 全部类型名（用于下拉选择） */
export const PARAM_TYPES = Object.keys(PARAM_TYPE_META)

/** 列表类参数类型（value 为纯数组）。注意 StructList 的 value 是对象，不属于此集合 */
export const LIST_PARAM_TYPES = new Set(
  PARAM_TYPES.filter((t) => PARAM_TYPE_META[t].kind === 'list')
)

export function getTypeMeta(paramType) {
  return (
    PARAM_TYPE_META[paramType] || {
      kind: 'scalar',
      title: paramType,
      color: '#334155',
      background: '#e2e8f0',
      scalarDefault: ''
    }
  )
}

export function isListType(paramType) {
  return LIST_PARAM_TYPES.has(paramType)
}

export function isStructType(paramType) {
  return paramType === 'Struct'
}

export function isStructListType(paramType) {
  return paramType === 'StructList'
}

export function isDictType(paramType) {
  return paramType === 'Dict'
}

export function isVector3Type(paramType) {
  return paramType === 'Vector3'
}

export function isBoolType(paramType) {
  return paramType === 'Bool'
}

/** 需要以 JSON 文本方式编辑的复合类型 */
export function isComplexType(paramType) {
  return isStructType(paramType) || isStructListType(paramType) || isDictType(paramType)
}

/** 依据参数类型给出默认值 */
export function defaultValueForType(paramType) {
  const m = getTypeMeta(paramType)
  switch (m.kind) {
    case 'list':
      return []
    case 'struct':
      return { structId: '', type: 'Struct', value: [] }
    case 'structList':
      return { structId: '', value: [] }
    case 'dict':
      return { type: 'Dict', key_type: 'String', value_type: 'String', value: [] }
    default:
      return m.scalarDefault ?? ''
  }
}

/**
 * 将「结构体（定义）」解析为内部编辑模型（字段列表）。
 * @param {object} def 结构体 JSON
 * @returns {{name: string, structType: string, fields: Array}}
 */
export function parseStructDefinition(def) {
  if (!def || def.type !== 'Struct' || !Array.isArray(def.value)) {
    throw new Error('不是合法的“结构体”JSON（缺少 type=Struct 或 value 数组）')
  }
  const fields = def.value.map((item, index) => {
    const paramType = item.param_type ?? item.value?.param_type ?? 'String'
    const rawValue = item.value && typeof item.value === 'object' && 'value' in item.value
      ? item.value.value
      : item.value
    return {
      key: item.key ?? `字段_${index + 1}`,
      paramType,
      value: normalizeValue(paramType, rawValue)
    }
  })
  return {
    // 保留原字段名（含样例中的 struct_ype 拼写）以便高保真还原
    name: def.name ?? '未命名结构体',
    structType: def.struct_ype ?? def.struct_type ?? 'basic',
    fields
  }
}

/**
 * 将「结构体变量」按给定的字段模板解析为内部编辑模型。
 * 结构体变量没有字段名，按位置与模板对齐。
 * @param {object} variable 结构体变量 JSON
 * @param {Array} [template] 可选字段模板（来自结构体定义），用于补齐字段名
 */
export function parseStructVariable(variable, template = []) {
  if (!variable || variable.type !== 'Struct' || !Array.isArray(variable.value)) {
    throw new Error('不是合法的“结构体变量”JSON（缺少 type=Struct 或 value 数组）')
  }
  const fields = variable.value.map((item, index) => {
    const paramType = item.param_type ?? 'String'
    const tpl = template[index]
    return {
      key: tpl?.key ?? `字段_${index + 1}`,
      paramType,
      value: normalizeValue(paramType, item.value)
    }
  })
  return {
    structId: variable.structId ?? '',
    fields
  }
}

/** 归一化值：按类型转换为内部编辑表示 */
function normalizeValue(paramType, rawValue) {
  const m = getTypeMeta(paramType)
  if (m.kind === 'list') {
    return Array.isArray(rawValue) ? rawValue : []
  }
  if (m.kind === 'struct' || m.kind === 'structList' || m.kind === 'dict') {
    return rawValue && typeof rawValue === 'object' ? rawValue : defaultValueForType(paramType)
  }
  if (rawValue === null || rawValue === undefined) {
    return defaultValueForType(paramType)
  }
  return String(rawValue)
}

/**
 * 内部编辑模型 → 结构体（定义）JSON
 * @param {{name:string, structType:string, fields:Array}} model
 */
export function buildStructDefinition(model) {
  return {
    type: 'Struct',
    struct_ype: model.structType || 'basic',
    name: model.name || '未命名结构体',
    value: model.fields.map((f) => ({
      key: f.key,
      param_type: f.paramType,
      value: {
        param_type: f.paramType,
        value: serializeValue(f.paramType, f.value)
      }
    }))
  }
}

/**
 * 内部编辑模型 → 结构体变量 JSON
 * @param {{fields:Array}} model
 * @param {string} structId
 */
export function buildStructVariable(model, structId) {
  return {
    structId: String(structId ?? ''),
    type: 'Struct',
    value: model.fields.map((f) => ({
      param_type: f.paramType,
      value: serializeValue(f.paramType, f.value)
    }))
  }
}

/** 序列化单个值以写入 JSON */
function serializeValue(paramType, value) {
  const m = getTypeMeta(paramType)
  if (m.kind === 'list') {
    return Array.isArray(value) ? value : []
  }
  if (m.kind === 'struct' || m.kind === 'structList' || m.kind === 'dict') {
    return value && typeof value === 'object' ? value : defaultValueForType(paramType)
  }
  return value === null || value === undefined ? defaultValueForType(paramType) : String(value)
}

/**
 * 结构体定义 → 结构体变量（丢弃字段名，保留类型与位置值，附加 structId）
 */
export function definitionToVariable(def, structId) {
  const model = parseStructDefinition(def)
  return buildStructVariable(model, structId)
}

/** 带缩进的 JSON 序列化 */
export function toJSON(obj, space = 2) {
  return JSON.stringify(obj, null, space)
}

/** 安全解析 JSON，抛出更友好的错误 */
export function fromJSON(text) {
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 解析失败：' + e.message)
  }
}

/** 判断一段 JSON 是结构体定义还是结构体变量 */
export function detectKind(obj) {
  if (!obj || obj.type !== 'Struct' || !Array.isArray(obj.value)) return 'unknown'
  if ('structId' in obj) return 'variable'
  if (obj.value.some((v) => v && typeof v === 'object' && 'key' in v)) return 'definition'
  return 'variable'
}

/** 列表类型 → 元素标量类型（如 Int32List → Int32） */
export function listElementType(paramType) {
  if (!paramType || !paramType.endsWith('List')) return 'String'
  const base = paramType.slice(0, -'List'.length)
  return PARAM_TYPE_META[base] ? base : 'String'
}

/**
 * 由结构体定义生成一个“空的结构体变量值对象”（用于给 StructList / Dict 新增子项）。
 * 返回形如 { structId, type:'Struct', value:[ {param_type, value} ] }
 */
export function blankStructValue(def) {
  if (!def) return { structId: '', type: 'Struct', value: [] }
  return {
    structId: String(def.structId ?? ''),
    type: 'Struct',
    value: (def.fields ?? []).map((f) => ({
      param_type: f.paramType,
      value: JSON.parse(JSON.stringify(defaultValueForType(f.paramType)))
    }))
  }
}

