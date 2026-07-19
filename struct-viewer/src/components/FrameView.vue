<script setup>
import { ref, reactive, computed, inject } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import {
  PARAM_TYPES,
  PARAM_TYPE_META,
  getTypeMeta,
  defaultValueForType,
  isListType,
  isComplexType,
  listElementType,
  blankStructValue
} from '../lib/miliastra.js'
import ScalarValue from './ScalarValue.vue'
import InlineList from './InlineList.vue'

// 允许在展开内容里递归渲染自身
defineOptions({ name: 'FrameView' })

const props = defineProps({
  frame: { type: Object, required: true },
  editableSchema: { type: Boolean, default: false }
})

const store = useWorkspaceStore()
const navigate = inject('navigate')

const deepClone = (x) => JSON.parse(JSON.stringify(x))

// 依据 structId 找到当前存档里的结构体定义
function resolveDef(structId) {
  return store.definitions.find((d) => String(d.structId) === String(structId)) || null
}
function resolveKeys(structId) {
  const def = resolveDef(structId)
  return def ? def.fields.map((f) => f.key) : null
}

function typeLabel(t) {
  return `${PARAM_TYPE_META[t]?.title ?? t}（${t}）`
}
function summarize(paramType, val) {
  if (isListType(paramType)) return `${Array.isArray(val) ? val.length : 0} 项`
  if (paramType === 'StructList') return `${val?.value?.length ?? 0} 项`
  if (paramType === 'Dict') return `${val?.value?.length ?? 0} 条`
  if (paramType === 'Struct') return `${val?.value?.length ?? 0} 字段`
  return ''
}

/** 复合类型引用的结构体名称（StructList → 元素结构体；Dict 值为结构体时 → 值结构体） */
function refName(paramType, val) {
  if (paramType === 'StructList') {
    const d = resolveDef(val && val.structId)
    return d ? d.name : val && val.structId ? `索引 ${val.structId}` : ''
  }
  if (paramType === 'Dict' && val && (val.value_type === 'Struct' || val.value_type === 'StructList')) {
    const d = resolveDef(val.value_structId)
    return d ? d.name : val.value_structId ? `索引 ${val.value_structId}` : ''
  }
  return ''
}

/* ---- 定义模式：复合类型“引用/类型声明” ---- */
// 可被引用的结构体定义（含自身，允许递归引用）
const refDefs = computed(() => store.definitions)
// 字典 key 可用的标量类型
const DICT_SCALAR_TYPES = ['String', 'Int32', 'Int64', 'Guid', 'ConfigReference', 'EntityReference', 'Army']

function refStructId(row) {
  const v = row.ref.value
  return v && v.structId != null ? String(v.structId) : ''
}
// 选择 Struct / StructList 引用的子结构体定义 → 自动生成默认值
function setStructRef(row, structId) {
  const d = resolveDef(structId)
  if (row.paramType === 'Struct') {
    row.ref.value = d ? blankStructValue(d) : { structId: String(structId), type: 'Struct', value: [] }
  } else {
    // StructList 默认空列表
    row.ref.value = { structId: String(structId), value: [] }
  }
}
// 字典的 key_type / value_type / value_structId 声明
function setDictType(row, which, val) {
  const dict = row.ref.value
  dict[which] = val
  if (which === 'value_type') {
    dict.value = []
    if (val === 'Struct' || val === 'StructList') {
      if (!dict.value_structId) dict.value_structId = String(refDefs.value[0]?.structId ?? '')
    } else {
      delete dict.value_structId
    }
  }
}
function setDictValStruct(row, structId) {
  row.ref.value.value_structId = String(structId)
}


/* ---------------- struct 帧 ---------------- */
const structRows = computed(() => {
  const f = props.frame
  if (f.rootFields) {
    return f.rootFields.map((fd, i) => ({ key: fd.key, paramType: fd.paramType, ref: fd, i, src: fd, root: true }))
  }
  const keys = f.keys || []
  return (f.structObj?.value ?? []).map((it, i) => ({
    key: keys[i] ?? `[${i}]`,
    paramType: it.param_type,
    ref: it,
    i,
    src: it,
    root: false
  }))
})

function enterField(row) {
  navigate(buildChildFrame(row.key, row.paramType, row.ref.value))
}

/* 复合类型就地折叠展开：Struct 默认展开，StructList/Dict 默认折叠 */
const toggled = reactive(new Set())
function defaultExpanded(row) {
  return row.paramType === 'Struct'
}
function isExpanded(row) {
  return toggled.has(row.i) ? !defaultExpanded(row) : defaultExpanded(row)
}
function toggleExpand(row) {
  if (toggled.has(row.i)) toggled.delete(row.i)
  else toggled.add(row.i)
}

function buildChildFrame(label, paramType, val) {
  if (paramType === 'StructList') {
    return { kind: 'structList', label, slVal: val }
  }
  if (paramType === 'Dict') {
    return { kind: 'dict', label, dictVal: val }
  }
  // Struct（含无法解析的结构体）
  return { kind: 'struct', label, structObj: val, keys: resolveKeys(val?.structId) }
}

/* 把单个结构体包装成“只有 1 行的结构体列表”帧，复用同一套网格样式 */
const structSingleCache = new WeakMap()
function structAsListFrame(structObj, label) {
  if (!structObj) return null
  let f = structSingleCache.get(structObj)
  if (!f) {
    f = {
      kind: 'structList',
      label,
      single: true,
      slVal: {
        structId: structObj.structId,
        value: [{ param_type: 'Struct', value: structObj }]
      }
    }
    structSingleCache.set(structObj, f)
  }
  return f
}

// 定义模式下的字段增删改
function addField() {
  props.frame.rootFields.push({
    key: `字段_${props.frame.rootFields.length + 1}`,
    paramType: 'Int32',
    value: defaultValueForType('Int32')
  })
}
function removeField(i) {
  props.frame.rootFields.splice(i, 1)
}
function moveField(i, d) {
  const arr = props.frame.rootFields
  const t = i + d
  if (t < 0 || t >= arr.length) return
  const [x] = arr.splice(i, 1)
  arr.splice(t, 0, x)
}
function changeType(row) {
  return (e) => {
    row.src.paramType = e.target.value
    row.src.value = defaultValueForType(e.target.value)
  }
}

/* ---------------- structList 帧 ---------------- */
const slDef = computed(() => resolveDef(props.frame.slVal?.structId))
const slCols = computed(() => {
  const def = slDef.value
  if (def) return def.fields.map((f, i) => ({ key: f.key, paramType: f.paramType, i }))
  // 无定义：从第一项推断
  const first = props.frame.slVal?.value?.[0]?.value?.value
  if (Array.isArray(first)) return first.map((it, i) => ({ key: `[${i}]`, paramType: it.param_type, i }))
  return []
})
const slRows = computed(() => props.frame.slVal?.value ?? [])
function slCell(item, colIdx) {
  return item?.value?.value?.[colIdx] // { param_type, value }
}

/* ---- Excel 化：把嵌套的定长结构体递归拍平成“点分列”（多层全部展开，靠 seen 防自引用环） ---- */
function buildFlatCols(fields, prefix, path, depth, seen) {
  const cols = []
  fields.forEach((f, i) => {
    const p = [...path, i]
    const label = prefix ? `${prefix}.${f.key}` : f.key
    if (f.paramType === 'Struct') {
      const subId = f.value && f.value.structId != null ? String(f.value.structId) : ''
      const subDef = resolveDef(subId)
      if (subDef && !seen.includes(subId)) {
        cols.push(...buildFlatCols(subDef.fields, label, p, depth + 1, [...seen, subId]))
        return
      }
    }
    cols.push({ label, group: prefix, leaf: f.key, path: p, paramType: f.paramType })
  })
  return cols
}
// 拍平后的列（仅当能解析到定义时启用）
const slFlatCols = computed(() => {
  const def = slDef.value
  if (!def) return null
  return buildFlatCols(def.fields, '', [], 0, [String(def.structId)])
})
// 把连续同属一个结构体（group 相同）的列聚成“分组表头”，空 group 为独立列
const slHeaderRuns = computed(() => {
  const cols = slFlatCols.value
  if (!cols) return null
  const runs = []
  let i = 0
  while (i < cols.length) {
    const g = cols[i].group
    if (!g) {
      runs.push({ group: '', cols: [cols[i]] })
      i++
    } else {
      let j = i
      while (j < cols.length && cols[j].group === g) j++
      runs.push({ group: g, cols: cols.slice(i, j) })
      i = j
    }
  }
  return runs
})
// 按 path 取到叶子 { param_type, value }；缺失的中间结构体节点会惰性补齐
function cellByPath(item, path) {
  let node = item?.value // 结构体对象 {structId,type,value:[]}
  for (let k = 0; k < path.length; k++) {
    if (!node || !Array.isArray(node.value)) return null
    const entry = node.value[path[k]]
    if (!entry) return null
    if (k === path.length - 1) return entry
    node = entry.value // 下一层结构体对象
  }
  return null
}

/* 递归生成“深默认结构体”，让新增项的嵌套结构体也带完整字段 */
function deepBlankStruct(def, seen = []) {
  return {
    structId: String(def.structId ?? ''),
    type: 'Struct',
    value: def.fields.map((f) => {
      if (f.paramType === 'Struct') {
        const subId = f.value && f.value.structId != null ? String(f.value.structId) : ''
        const subDef = resolveDef(subId)
        if (subDef && !seen.includes(subId)) {
          return { param_type: 'Struct', value: deepBlankStruct(subDef, [...seen, String(def.structId)]) }
        }
        return { param_type: 'Struct', value: { structId: subId, type: 'Struct', value: [] } }
      }
      if (f.paramType === 'StructList') {
        const subId = f.value && f.value.structId != null ? String(f.value.structId) : ''
        return { param_type: 'StructList', value: { structId: subId, value: [] } }
      }
      if (f.paramType === 'Dict') {
        return { param_type: 'Dict', value: deepClone(f.value) }
      }
      return { param_type: f.paramType, value: deepClone(defaultValueForType(f.paramType)) }
    })
  }
}
function slEnterFlat(item, col) {
  const leaf = cellByPath(item, col.path)
  if (leaf) navigate(buildChildFrame(col.label, col.paramType, leaf.value))
}

/* 标量列表在单元格内联编辑；Vector3List 宽度有界(X/Y/Z)也可行内 */
function isInlineList(paramType) {
  return isListType(paramType)
}
function slNewItem() {
  const def = slDef.value
  const struct = def
    ? deepBlankStruct(def)
    : deepClone(props.frame.slVal.value[0]?.value ?? { structId: props.frame.slVal.structId, type: 'Struct', value: [] })
  return { param_type: 'Struct', value: struct }
}
function slAdd() {
  props.frame.slVal.value.push(slNewItem())
}
function slDup(i) {
  props.frame.slVal.value.splice(i + 1, 0, deepClone(props.frame.slVal.value[i]))
}
function slRemove(i) {
  props.frame.slVal.value.splice(i, 1)
}
function slMove(i, d) {
  const arr = props.frame.slVal.value
  const t = i + d
  if (t < 0 || t >= arr.length) return
  const [x] = arr.splice(i, 1)
  arr.splice(t, 0, x)
}
function slEnterCell(item, col) {
  navigate(buildChildFrame(col.key, col.paramType, slCell(item, col.i).value))
}

/* structList 批量文本(TSV)：行=结构体项，列=字段，可与 Excel 互贴 */
const slMode = ref('grid') // grid | tsv
const slText = ref('')
const COL_DELIM = '\t'
const LIST_DELIM = '|'
function serCell(paramType, value) {
  if (isListType(paramType)) return Array.isArray(value) ? value.join(LIST_DELIM) : ''
  if (isComplexType(paramType)) return JSON.stringify(value ?? null)
  return value == null ? '' : String(value)
}
function parseCell(paramType, text) {
  if (isListType(paramType)) return text === '' ? [] : text.split(LIST_DELIM)
  if (isComplexType(paramType)) {
    try {
      return JSON.parse(text)
    } catch {
      return deepClone(defaultValueForType(paramType))
    }
  }
  return text
}
function slGenTsv() {
  const flat = slFlatCols.value
  if (flat) {
    const header = flat.map((c) => c.label).join(COL_DELIM)
    const lines = slRows.value.map((item) =>
      flat.map((c) => serCell(c.paramType, cellByPath(item, c.path)?.value)).join(COL_DELIM)
    )
    slText.value = [header, ...lines].join('\n')
    slMode.value = 'tsv'
    return
  }
  const cols = slCols.value
  const header = cols.map((c) => c.key).join(COL_DELIM)
  const lines = slRows.value.map((item) =>
    cols.map((c) => serCell(c.paramType, slCell(item, c.i)?.value)).join(COL_DELIM)
  )
  slText.value = [header, ...lines].join('\n')
  slMode.value = 'tsv'
}
function slApplyTsv() {
  const rows = slText.value.split('\n')
  const body = rows.slice(1).filter((l) => l.trim() !== '')
  const flat = slFlatCols.value
  if (flat && slDef.value) {
    const items = body.map((line) => {
      const cells = line.split(COL_DELIM)
      const struct = deepBlankStruct(slDef.value)
      const item = { param_type: 'Struct', value: struct }
      flat.forEach((c, ci) => {
        const leaf = cellByPath(item, c.path)
        if (leaf) leaf.value = parseCell(c.paramType, (cells[ci] ?? '').trim())
      })
      return item
    })
    props.frame.slVal.value.splice(0, props.frame.slVal.value.length, ...items)
    slMode.value = 'grid'
    return
  }
  const cols = slCols.value
  const items = body.map((line) => {
    const cells = line.split(COL_DELIM)
    return {
      param_type: 'Struct',
      value: {
        structId: String(props.frame.slVal.structId ?? ''),
        type: 'Struct',
        value: cols.map((c, ci) => ({
          param_type: c.paramType,
          value: parseCell(c.paramType, (cells[ci] ?? '').trim())
        }))
      }
    }
  })
  props.frame.slVal.value.splice(0, props.frame.slVal.value.length, ...items)
  slMode.value = 'grid'
}

/* ---------------- dict 帧 ---------------- */
const dictEntries = computed(() => props.frame.dictVal?.value ?? [])
const dictKeyType = computed(() => props.frame.dictVal?.key_type ?? 'String')
const dictValType = computed(() => props.frame.dictVal?.value_type ?? 'String')
const dictValComplex = computed(() => isComplexType(dictValType.value)) // Struct/StructList → 进入
const dictValList = computed(() => isListType(dictValType.value)) // 列表 → 行内
function dictDefaultValue() {
  const vt = dictValType.value
  if (vt === 'Struct') return blankStructValue(resolveDef(props.frame.dictVal.value_structId))
  if (vt === 'StructList') return { structId: String(props.frame.dictVal.value_structId ?? ''), value: [] }
  if (isListType(vt)) return []
  return defaultValueForType(vt)
}
function dictAdd() {
  props.frame.dictVal.value.push({
    key: { param_type: dictKeyType.value, value: defaultValueForType(dictKeyType.value) },
    value: { param_type: dictValType.value, value: dictDefaultValue() }
  })
}
function dictRemove(i) {
  props.frame.dictVal.value.splice(i, 1)
}
function dictDup(i) {
  const arr = props.frame.dictVal.value
  const copy = deepClone(arr[i])
  // 字典键不可重复：为副本生成唯一的 _1 / _2 ... 后缀
  const base = String(copy.key.value ?? '').replace(/_\d+$/, '')
  const existing = new Set(arr.map((e) => String(e.key.value)))
  let n = 1
  while (existing.has(`${base}_${n}`)) n++
  copy.key.value = `${base}_${n}`
  arr.splice(i + 1, 0, copy)
}
function dictMove(i, d) {
  const arr = props.frame.dictVal.value
  const t = i + d
  if (t < 0 || t >= arr.length) return
  const [x] = arr.splice(i, 1)
  arr.splice(t, 0, x)
}
function dictEnterValue(entry) {
  navigate(buildChildFrame('值', dictValType.value, entry.value.value))
}

// 简单标量字典的批量文本（key<TAB>value 每行一条）
const dictScalar = computed(() => !dictValComplex.value && !dictValList.value)
const dictMode = ref('form')
const dictText = ref('')
function dictOpenText() {
  dictText.value = dictEntries.value.map((e) => `${e.key.value}\t${e.value.value}`).join('\n')
  dictMode.value = 'text'
}
function dictApplyText() {
  const rows = dictText.value.split('\n').filter((l) => l.trim() !== '')
  const entries = rows.map((line) => {
    const [k, ...rest] = line.split('\t')
    return {
      key: { param_type: dictKeyType.value, value: k ?? '' },
      value: { param_type: dictValType.value, value: rest.join('\t') ?? '' }
    }
  })
  props.frame.dictVal.value.splice(0, props.frame.dictVal.value.length, ...entries)
  dictMode.value = 'form'
}
</script>

<template>
  <!-- ============ struct ============ -->
  <div v-if="frame.kind === 'struct'">
    <div v-if="editableSchema" class="toolbar">
      <button class="primary" @click="addField">+ 添加字段</button>
      <span class="hint">共 {{ structRows.length }} 个字段</span>
    </div>

    <table class="field-table">
      <thead>
        <tr>
          <th style="width:34px">#</th>
          <th style="width:24%">字段名</th>
          <th style="width:22%">类型</th>
          <th>值</th>
          <th v-if="editableSchema" style="width:110px">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in structRows" :key="row.i">
        <tr>
          <td>{{ row.i }}</td>
          <td>
            <input v-if="editableSchema" type="text" v-model="row.src.key" />
            <span v-else class="chip">{{ row.key }}</span>
          </td>
          <td>
            <select v-if="editableSchema" :value="row.paramType" @change="changeType(row)($event)">
              <option v-for="t in PARAM_TYPES" :key="t" :value="t">{{ typeLabel(t) }}</option>
            </select>
            <span v-else class="hint">{{ typeLabel(row.paramType) }}</span>
          </td>
          <td>
            <!-- 定义模式：Struct / StructList 声明引用（展开内容见下方整行） -->
            <div v-if="editableSchema && (row.paramType === 'Struct' || row.paramType === 'StructList')" class="ref-row">
              <span class="hint">包含结构体</span>
              <select :value="refStructId(row)" @change="setStructRef(row, $event.target.value)">
                <option value="">（选择结构体定义）</option>
                <option v-for="d in refDefs" :key="d.id" :value="d.structId">
                  {{ d.name }}（{{ d.structId || '未设ID' }}）
                </option>
              </select>
              <button class="enter-btn small" @click="toggleExpand(row)">
                {{ isExpanded(row) ? '▾ 收起默认' : '▸ 展开默认' }}（{{ summarize(row.paramType, row.ref.value) }}）
              </button>
            </div>

            <!-- 定义模式：Dict 声明 键/值 类型（展开内容见下方整行） -->
            <div v-else-if="editableSchema && row.paramType === 'Dict'" class="ref-row">
              <span class="hint">键</span>
              <select :value="row.ref.value.key_type" @change="setDictType(row, 'key_type', $event.target.value)">
                <option v-for="t in DICT_SCALAR_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
              <span class="hint">值</span>
              <select :value="row.ref.value.value_type" @change="setDictType(row, 'value_type', $event.target.value)">
                <option v-for="t in PARAM_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
              <template v-if="row.ref.value.value_type === 'Struct' || row.ref.value.value_type === 'StructList'">
                <span class="hint">值结构体</span>
                <select :value="row.ref.value.value_structId" @change="setDictValStruct(row, $event.target.value)">
                  <option v-for="d in refDefs" :key="d.id" :value="d.structId">{{ d.name }}（{{ d.structId || '未设ID' }}）</option>
                </select>
              </template>
              <button class="enter-btn small" @click="toggleExpand(row)">
                {{ isExpanded(row) ? '▾ 收起默认' : '▸ 展开默认' }}（{{ summarize('Dict', row.ref.value) }}）
              </button>
            </div>

            <!-- 标量列表（含 Vector3List）：行内编辑 -->
            <InlineList
              v-else-if="isListType(row.paramType)"
              :item-type="listElementType(row.paramType)"
              :model-value="row.ref.value"
              @update:model-value="row.ref.value = $event"
            />

            <!-- 数据模式：Struct / StructList / Dict 折叠头（展开内容见下方整行，从第一列开始） -->
            <div v-else-if="isComplexType(row.paramType)" class="collapse-head">
              <button class="enter-btn" @click="toggleExpand(row)">
                <span class="chip">{{ getTypeMeta(row.paramType).title }}</span>
                <span v-if="refName(row.paramType, row.ref.value)" class="ref-name">〈{{ refName(row.paramType, row.ref.value) }}〉</span>
                <span class="summary">{{ summarize(row.paramType, row.ref.value) }}</span>
                <span class="arrow">{{ isExpanded(row) ? '▾ 收起' : '▸ 展开' }}</span>
              </button>
              <button
                v-if="row.paramType !== 'Struct'"
                class="ghost icon-btn"
                title="在新视图中打开"
                @click="enterField(row)"
              >↗</button>
            </div>
            <ScalarValue v-else :param-type="row.paramType" v-model="row.ref.value" />
          </td>
          <td v-if="editableSchema">
            <button class="ghost icon-btn" @click="moveField(row.i, -1)" :disabled="row.i === 0">↑</button>
            <button class="ghost icon-btn" @click="moveField(row.i, 1)" :disabled="row.i === structRows.length - 1">↓</button>
            <button class="ghost icon-btn danger" @click="removeField(row.i)">✕</button>
          </td>
        </tr>
        <!-- 展开的完整内容：跨整行、从第一列开始渲染（结构体视作 1 行的结构体列表） -->
        <tr v-if="isComplexType(row.paramType) && isExpanded(row)" class="expand-row">
          <td :colspan="editableSchema ? 5 : 4">
            <FrameView
              v-if="row.paramType === 'Struct' && row.ref.value"
              :frame="structAsListFrame(row.ref.value, row.key)"
              :editable-schema="false"
            />
            <FrameView
              v-else
              :frame="buildChildFrame(row.key, row.paramType, row.ref.value)"
              :editable-schema="false"
            />
          </td>
        </tr>
      </template>
      <tr v-if="structRows.length === 0"><td :colspan="editableSchema ? 5 : 4" class="hint">暂无字段。</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ============ structList（表格 / TSV） ============ -->
  <div v-else-if="frame.kind === 'structList'">
    <div v-if="!frame.single" class="toolbar">
      <button :class="{ primary: slMode === 'grid' }" @click="slMode = 'grid'">表格</button>
      <button :class="{ primary: slMode === 'tsv' }" @click="slGenTsv">批量文本(TSV)</button>
      <span class="hint">
        结构体列表 · 共 {{ slRows.length }} 项
        <template v-if="slDef">· 绑定定义「{{ slDef.name }}」</template>
        <template v-else>· 未找到 结构体索引={{ frame.slVal.structId }} 的定义，按位置显示</template>
      </span>
    </div>

    <template v-if="slMode === 'grid'">
      <div class="grid-scroll">
        <!-- 拍平列：嵌套定长结构体展开成点分列，可直接内联编辑（Excel 化） -->
        <table v-if="slFlatCols" class="grid-table">
          <thead>
            <tr v-if="frame.single">
              <th :colspan="slFlatCols.length" class="group-th struct-banner">
                ⤷ {{ frame.label }}<template v-if="slDef">〈{{ slDef.name }}〉</template>
              </th>
            </tr>
            <tr>
              <th v-if="!frame.single" rowspan="2" style="width:34px">#</th>
              <template v-for="(run, ri) in slHeaderRuns" :key="ri">
                <th v-if="!run.group" rowspan="2">
                  <span class="col-leaf">{{ run.cols[0].leaf }}</span>
                  <span class="hint col-type">{{ getTypeMeta(run.cols[0].paramType).title }}</span>
                </th>
                <th v-else :colspan="run.cols.length" class="group-th" :title="`结构体：${run.group}`">
                  ⤷ {{ run.group }}
                </th>
              </template>
              <th v-if="!frame.single" rowspan="2" style="width:150px">操作</th>
            </tr>
            <tr>
              <template v-for="(run, ri) in slHeaderRuns" :key="ri">
                <template v-if="run.group">
                  <th v-for="(c, ci) in run.cols" :key="ci" class="group-leaf">
                    <span class="col-leaf">{{ c.leaf }}</span>
                    <span class="hint col-type">{{ getTypeMeta(c.paramType).title }}</span>
                  </th>
                </template>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, ri) in slRows" :key="ri">
              <td v-if="!frame.single">{{ ri }}</td>
              <td v-for="(col, ci) in slFlatCols" :key="ci">
                <template v-if="cellByPath(item, col.path)">
                  <InlineList
                    v-if="isInlineList(col.paramType)"
                    :item-type="listElementType(col.paramType)"
                    :model-value="cellByPath(item, col.path).value"
                    @update:model-value="cellByPath(item, col.path).value = $event"
                  />
                  <button
                    v-else-if="isComplexType(col.paramType) || isListType(col.paramType)"
                    class="enter-btn small"
                    @click="slEnterFlat(item, col)"
                  >
                    {{ summarize(col.paramType, cellByPath(item, col.path).value) }} ▸
                  </button>
                  <ScalarValue
                    v-else
                    :param-type="col.paramType"
                    :model-value="cellByPath(item, col.path).value"
                    @update:model-value="cellByPath(item, col.path).value = $event"
                  />
                </template>
                <span v-else class="hint">—</span>
              </td>
              <td v-if="!frame.single">
                <button class="ghost icon-btn" title="复制整行" @click="slDup(ri)">⧉</button>
                <button class="ghost icon-btn" @click="slMove(ri, -1)" :disabled="ri === 0">↑</button>
                <button class="ghost icon-btn" @click="slMove(ri, 1)" :disabled="ri === slRows.length - 1">↓</button>
                <button class="ghost icon-btn danger" @click="slRemove(ri)">✕</button>
              </td>
            </tr>
            <tr v-if="slRows.length === 0"><td :colspan="slFlatCols.length + 2" class="hint">空列表。</td></tr>
          </tbody>
        </table>

        <!-- 无定义时回退：按位置显示 -->
        <table v-else class="grid-table">
          <thead>
            <tr v-if="frame.single">
              <th :colspan="slCols.length" class="group-th struct-banner">⤷ {{ frame.label }}</th>
            </tr>
            <tr>
              <th v-if="!frame.single" style="width:34px">#</th>
              <th v-for="col in slCols" :key="col.i">{{ col.key }}<br /><span class="hint">{{ getTypeMeta(col.paramType).title }}</span></th>
              <th v-if="!frame.single" style="width:150px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, ri) in slRows" :key="ri">
              <td v-if="!frame.single">{{ ri }}</td>
              <td v-for="col in slCols" :key="col.i">
                <InlineList
                  v-if="isInlineList(col.paramType) && slCell(item, col.i)"
                  :item-type="listElementType(col.paramType)"
                  :model-value="slCell(item, col.i).value"
                  @update:model-value="slCell(item, col.i).value = $event"
                />
                <button
                  v-else-if="isComplexType(col.paramType) || isListType(col.paramType)"
                  class="enter-btn small"
                  @click="slEnterCell(item, col)"
                >
                  {{ summarize(col.paramType, slCell(item, col.i)?.value) }} ▸
                </button>
                <ScalarValue
                  v-else-if="slCell(item, col.i)"
                  :param-type="col.paramType"
                  :model-value="slCell(item, col.i).value"
                  @update:model-value="slCell(item, col.i).value = $event"
                />
              </td>
              <td v-if="!frame.single">
                <button class="ghost icon-btn" title="复制整行" @click="slDup(ri)">⧉</button>
                <button class="ghost icon-btn" @click="slMove(ri, -1)" :disabled="ri === 0">↑</button>
                <button class="ghost icon-btn" @click="slMove(ri, 1)" :disabled="ri === slRows.length - 1">↓</button>
                <button class="ghost icon-btn danger" @click="slRemove(ri)">✕</button>
              </td>
            </tr>
            <tr v-if="slRows.length === 0"><td :colspan="slCols.length + 2" class="hint">空列表。</td></tr>
          </tbody>
        </table>
      </div>
      <button v-if="!frame.single" class="primary" style="margin-top:8px" @click="slAdd">+ 添加项</button>
    </template>

    <div v-else>
      <p class="hint">
        第一行为列名（只读参考）。每行一个结构体，列之间用 <b>Tab</b> 分隔，可从 Excel 整块粘贴/复制。
        嵌套的定长结构体已<b>拍平成点分列</b>（如 <code>需求货币.摩拉</code>）直接填值；
        列表字段用 <b>|</b> 分隔多个值（如 <code>1|2|3</code>）；仅变长的结构体列表/字典以 JSON 表示。
      </p>
      <textarea v-model="slText" class="tsv" style="min-height:320px"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="primary" @click="slApplyTsv">应用文本</button>
        <button @click="slMode = 'grid'">取消</button>
      </div>
    </div>
  </div>

  <!-- ============ dict（键值表格） ============ -->
  <div v-else-if="frame.kind === 'dict'">
    <div class="toolbar">
      <button v-if="dictScalar" :class="{ primary: dictMode === 'form' }" @click="dictMode = 'form'">表单</button>
      <button v-if="dictScalar" :class="{ primary: dictMode === 'text' }" @click="dictOpenText">批量文本</button>
      <span class="hint">键：{{ dictKeyType }} · 值：{{ dictValType }} · 共 {{ dictEntries.length }} 条</span>
    </div>

    <div v-if="dictMode === 'form'">
      <table class="grid-table">
        <thead><tr><th style="width:34px">#</th><th style="width:40%">键</th><th>值</th><th style="width:130px">操作</th></tr></thead>
        <tbody>
          <tr v-for="(entry, i) in dictEntries" :key="i">
            <td>{{ i }}</td>
            <td><ScalarValue :param-type="dictKeyType" :model-value="entry.key.value" @update:model-value="entry.key.value = $event" /></td>
            <td>
              <button v-if="dictValComplex" class="enter-btn small" @click="dictEnterValue(entry)">
                {{ getTypeMeta(dictValType).title }}<template v-if="refName(dictValType, entry.value.value)">〈{{ refName(dictValType, entry.value.value) }}〉</template> · {{ summarize(dictValType, entry.value.value) }} ▸
              </button>
              <InlineList
                v-else-if="dictValList"
                :item-type="listElementType(dictValType)"
                :model-value="entry.value.value"
                @update:model-value="entry.value.value = $event"
              />
              <ScalarValue v-else :param-type="dictValType" :model-value="entry.value.value" @update:model-value="entry.value.value = $event" />
            </td>
            <td>
              <button class="ghost icon-btn" title="复制此条" @click="dictDup(i)">⧉</button>
              <button class="ghost icon-btn" @click="dictMove(i, -1)" :disabled="i === 0">↑</button>
              <button class="ghost icon-btn" @click="dictMove(i, 1)" :disabled="i === dictEntries.length - 1">↓</button>
              <button class="ghost icon-btn danger" @click="dictRemove(i)">✕</button>
            </td>
          </tr>
          <tr v-if="dictEntries.length === 0"><td colspan="4" class="hint">空字典。</td></tr>
        </tbody>
      </table>
      <button class="primary" style="margin-top:8px" @click="dictAdd">+ 添加条目</button>
    </div>

    <div v-else>
      <p class="hint">每行一条，格式：键 &lt;Tab&gt; 值（可从 Excel 两列粘贴）。</p>
      <textarea v-model="dictText" style="min-height:280px"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="primary" @click="dictApplyText">应用文本</button>
        <button @click="dictMode = 'form'">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.enter-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px;
  padding: 4px 10px; cursor: pointer; color: var(--text);
}
.enter-btn:hover { border-color: var(--primary); }
.enter-btn .summary { color: var(--muted); font-size: 12px; }
.enter-btn .arrow { color: var(--primary); font-size: 12px; }
.enter-btn.small { padding: 2px 8px; font-size: 12px; }

.ref-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ref-row select { min-width: 120px; }

.collapse-head { display: flex; align-items: center; gap: 4px; }
.ref-name { color: #c9d2ff; font-size: 12px; }
.expand-row > td { background: rgba(108, 140, 255, 0.04); padding: 6px 8px; }

.grid-scroll { overflow-x: auto; }
.grid-table { border-collapse: collapse; width: 100%; }
.grid-table th, .grid-table td { border: 1px solid var(--border); padding: 4px 6px; vertical-align: top; }
.grid-table th { color: var(--muted); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
.col-leaf { display: block; color: var(--text); }
.col-type { display: block; font-weight: 400; }
.group-th { text-align: center; color: #c9d2ff; background: rgba(108, 140, 255, 0.14); border-bottom: 2px solid var(--primary); }
.struct-banner { text-align: left; }
.group-leaf { background: rgba(108, 140, 255, 0.05); }
.tsv { white-space: pre; overflow-wrap: normal; overflow-x: auto; }
</style>
