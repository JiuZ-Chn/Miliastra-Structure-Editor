<script setup>
import { ref, computed } from 'vue'
import { AlertTriangle, ArrowDown, ArrowUp, Copy, FileSpreadsheet, Plus, Table2, Trash2 } from '@lucide/vue'
import { NButton } from 'naive-ui'
import { useWorkspaceStore } from '../stores/workspace.js'
import {
  PARAM_TYPES,
  PARAM_TYPE_META,
  getTypeMeta,
  defaultValueForType,
  isListType,
  isComplexType,
  listElementType
} from '../lib/miliastra.js'
import {
  createBlankStructValue,
  flattenStructDefinition,
  getStructEntryAtPath,
  groupFlattenedColumns
} from '../lib/flatten.js'
import {
  assertHeader,
  decodeTabularValue,
  encodeTabularValue,
  parseTsv,
  stringifyTsv
} from '../lib/tabular.js'
import ScalarValue from './ScalarValue.vue'
import InlineList from './InlineList.vue'
import ActionIconButton from './ActionIconButton.vue'

// 允许在展开内容里递归渲染自身
defineOptions({ name: 'FrameView' })

const props = defineProps({
  frame: { type: Object, required: true },
  editableSchema: { type: Boolean, default: false }
})

const store = useWorkspaceStore()

const deepClone = (x) => JSON.parse(JSON.stringify(x))

// 依据 structId 找到当前存档里的结构体定义
function resolveDef(structId) {
  return store.definitions.find((d) => String(d.structId) === String(structId)) || null
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
  if (paramType === 'Struct' || paramType === 'StructList') {
    const d = resolveDef(val && val.structId)
    return d ? d.name : val && val.structId ? `需要结构体索引 ${val.structId}` : ''
  }
  if (paramType === 'Dict' && val && (val.value_type === 'Struct' || val.value_type === 'StructList')) {
    const d = resolveDef(val.value_structId)
    return d ? d.name : val.value_structId ? `需要结构体索引 ${val.value_structId}` : ''
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
    row.ref.value = d
      ? createBlankStructValue(d, resolveDef)
      : { structId: String(structId), type: 'Struct', value: [] }
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

function buildInlineFrame(label, paramType, val) {
  if (paramType === 'Struct') {
    return structAsListFrame(val, label)
  }
  if (paramType === 'StructList') {
    return { kind: 'structList', label, slVal: val }
  }
  if (paramType === 'Dict') {
    return { kind: 'dict', label, dictVal: val }
  }
  return null
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
  store.addField()
}
function removeField(i) {
  store.removeField(i)
}
function moveField(i, d) {
  store.moveField(i, d)
}
function changeType(row) {
  return (e) => store.changeFieldType(row.i, e.target.value)
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

// 拍平后的列（仅当能解析到定义时启用）
const slFlatCols = computed(() => {
  const def = slDef.value
  if (!def) return null
  return flattenStructDefinition(def, resolveDef)
})
// 把连续同属一个结构体（group 相同）的列聚成“分组表头”，空 group 为独立列
const slHeaderRuns = computed(() => {
  const cols = slFlatCols.value
  if (!cols) return null
  return groupFlattenedColumns(cols).map(({ group, columns }) => ({ group, cols: columns }))
})
// StructList 的行元素比 Struct 值多一层 `{ param_type, value }` 包装。
function cellByPath(item, path) {
  return getStructEntryAtPath(item?.value, path)
}
/* 标量列表在单元格内联编辑；Vector3List 宽度有界(X/Y/Z)也可行内 */
function isInlineList(paramType) {
  return isListType(paramType)
}
function slNewItem() {
  const def = slDef.value
  const struct = def
    ? createBlankStructValue(def, resolveDef)
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
/* structList 批量文本(TSV)：行=结构体项，列=字段，可与 Excel 互贴 */
const slMode = ref('grid') // grid | tsv
const slText = ref('')
const tableError = ref('')
function slGenTsv() {
  const flat = slFlatCols.value
  if (flat) {
    const header = flat.map((c) => c.label)
    const lines = slRows.value.map((item) =>
      flat.map((c) => encodeTabularValue(c.paramType, cellByPath(item, c.path)?.value))
    )
    slText.value = stringifyTsv([header, ...lines])
    tableError.value = ''
    slMode.value = 'tsv'
    return
  }
  const cols = slCols.value
  const header = cols.map((c) => c.key)
  const lines = slRows.value.map((item) =>
    cols.map((c) => encodeTabularValue(c.paramType, slCell(item, c.i)?.value))
  )
  slText.value = stringifyTsv([header, ...lines])
  tableError.value = ''
  slMode.value = 'tsv'
}
function slApplyTsv() {
  try {
    const rows = parseTsv(slText.value)
    const flat = slFlatCols.value
    const columns = flat ?? slCols.value
    const header = columns.map((column) => flat ? column.label : column.key)
    assertHeader(rows[0] ?? [], header)
    const body = rows.slice(1).filter((row) => row.some((cell) => cell !== ''))

    let items
    if (flat && slDef.value) {
      items = body.map((cells) => {
        const struct = createBlankStructValue(slDef.value, resolveDef)
        const item = { param_type: 'Struct', value: struct }
        flat.forEach((column, index) => {
          const leaf = cellByPath(item, column.path)
          if (leaf) leaf.value = decodeTabularValue(column.paramType, cells[index] ?? '')
        })
        return item
      })
    } else {
      items = body.map((cells) => ({
        param_type: 'Struct',
        value: {
          structId: String(props.frame.slVal.structId ?? ''),
          type: 'Struct',
          value: slCols.value.map((column, index) => ({
            param_type: column.paramType,
            value: decodeTabularValue(column.paramType, cells[index] ?? '')
          }))
        }
      }))
    }

    props.frame.slVal.value.splice(0, props.frame.slVal.value.length, ...items)
    tableError.value = ''
    slMode.value = 'grid'
  } catch (error) {
    tableError.value = `无法应用 TSV：${error.message}`
  }
}

/* ---------------- dict 帧 ---------------- */
const dictEntries = computed(() => props.frame.dictVal?.value ?? [])
const dictKeyType = computed(() => props.frame.dictVal?.key_type ?? 'String')
const dictValType = computed(() => props.frame.dictVal?.value_type ?? 'String')
const dictValComplex = computed(() => isComplexType(dictValType.value)) // Struct/StructList → 进入
const dictValList = computed(() => isListType(dictValType.value)) // 列表 → 行内
function dictDefaultValue() {
  const vt = dictValType.value
  if (vt === 'Struct') return createBlankStructValue(resolveDef(props.frame.dictVal.value_structId), resolveDef)
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
// 简单标量字典的批量文本（key<TAB>value 每行一条）
const dictScalar = computed(() => !dictValComplex.value && !dictValList.value)
const dictMode = ref('form')
const dictText = ref('')
function dictOpenText() {
  dictText.value = stringifyTsv([
    ['键', '值'],
    ...dictEntries.value.map((entry) => [
      encodeTabularValue(dictKeyType.value, entry.key.value),
      encodeTabularValue(dictValType.value, entry.value.value)
    ])
  ])
  tableError.value = ''
  dictMode.value = 'text'
}
function dictApplyText() {
  try {
    const rows = parseTsv(dictText.value)
    assertHeader(rows[0] ?? [], ['键', '值'])
    const entries = rows.slice(1)
      .filter((row) => row.some((cell) => cell !== ''))
      .map((row) => ({
        key: {
          param_type: dictKeyType.value,
          value: decodeTabularValue(dictKeyType.value, row[0] ?? '')
        },
        value: {
          param_type: dictValType.value,
          value: decodeTabularValue(dictValType.value, row[1] ?? '')
        }
      }))
    const keys = entries.map((entry) => String(entry.key.value))
    if (new Set(keys).size !== keys.length) throw new Error('字典键不能重复')
    props.frame.dictVal.value.splice(0, props.frame.dictVal.value.length, ...entries)
    tableError.value = ''
    dictMode.value = 'form'
  } catch (error) {
    tableError.value = `无法应用 TSV：${error.message}`
  }
}
</script>

<template>
  <!-- ============ struct ============ -->
  <div v-if="frame.kind === 'struct'">
    <div v-if="editableSchema" class="toolbar">
      <n-button type="primary" size="small" @click="addField">
        <template #icon><Plus :size="15" /></template>
        添加字段
      </n-button>
      <span class="hint">共 {{ structRows.length }} 个字段</span>
    </div>

    <table v-resizable-columns class="field-table">
      <thead>
        <tr>
          <th style="width:34px">#</th>
          <th style="width:24%">字段名</th>
          <th style="width:22%">类型</th>
          <th>值</th>
          <th v-if="editableSchema" class="operation-column compact">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in structRows" :key="row.i">
        <tr>
          <td>{{ row.i }}</td>
          <td>
            <input v-if="editableSchema" type="text" :value="row.src.key" @input="store.renameField(row.i, $event.target.value)" />
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
              <span class="complex-summary">{{ summarize(row.paramType, row.ref.value) }}</span>
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
              <span class="complex-summary">{{ summarize('Dict', row.ref.value) }}</span>
            </div>

            <!-- 标量列表（含 Vector3List）：行内编辑 -->
            <InlineList
              v-else-if="isListType(row.paramType)"
              :item-type="listElementType(row.paramType)"
              :model-value="row.ref.value"
              @update:model-value="row.ref.value = $event"
            />

            <!-- 数据模式：复合类型直接递归展开 -->
            <div v-else-if="isComplexType(row.paramType)" class="complex-summary-row">
              <span class="chip">{{ getTypeMeta(row.paramType).title }}</span>
              <span v-if="refName(row.paramType, row.ref.value)" class="ref-name">〈{{ refName(row.paramType, row.ref.value) }}〉</span>
              <span class="complex-summary">{{ summarize(row.paramType, row.ref.value) }}</span>
            </div>
            <ScalarValue v-else :param-type="row.paramType" v-model="row.ref.value" />
          </td>
          <td v-if="editableSchema" class="operation-column compact">
            <div class="row-actions">
              <ActionIconButton label="上移" :icon="ArrowUp" :disabled="row.i === 0" @click="moveField(row.i, -1)" />
              <ActionIconButton label="下移" :icon="ArrowDown" :disabled="row.i === structRows.length - 1" @click="moveField(row.i, 1)" />
              <ActionIconButton label="删除字段" :icon="Trash2" danger @click="removeField(row.i)" />
            </div>
          </td>
        </tr>
        <!-- 展开的完整内容：跨整行、从第一列开始渲染（结构体视作 1 行的结构体列表） -->
        <tr v-if="isComplexType(row.paramType)" class="expand-row">
          <td :colspan="editableSchema ? 5 : 4">
            <FrameView
              v-if="row.ref.value"
              :frame="buildInlineFrame(row.key, row.paramType, row.ref.value)"
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
    <template v-if="slMode === 'grid'">
      <div v-if="!slDef" class="missing-struct-notice">
        <AlertTriangle :size="14" />
        <span>缺少引用的结构体定义</span>
        <strong>需要结构体索引：{{ frame.slVal?.structId || '未设置' }}</strong>
        <span class="missing-struct-note">当前按位置显示已有数据</span>
      </div>
      <div class="grid-scroll">
        <!-- 拍平列：嵌套定长结构体展开成点分列，可直接内联编辑（Excel 化） -->
        <table v-if="slFlatCols" v-resizable-columns class="grid-table">
          <thead>
            <tr v-if="!frame.single">
              <th :colspan="slFlatCols.length + 2" class="mode-header-cell">
                <div class="table-mode-header">
                  <span class="table-mode-meta">{{ slRows.length }} 项</span>
                  <n-button size="tiny" type="primary" @click="slMode = 'grid'">
                    <template #icon><Table2 :size="14" /></template>
                    表格
                  </n-button>
                  <n-button size="tiny" secondary @click="slGenTsv">
                    <template #icon><FileSpreadsheet :size="14" /></template>
                    批量文本
                  </n-button>
                </div>
              </th>
            </tr>
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
              <th v-if="!frame.single" rowspan="2" class="operation-column">操作</th>
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
                  <FrameView
                    v-else-if="isComplexType(col.paramType)"
                    :frame="buildInlineFrame(col.label, col.paramType, cellByPath(item, col.path).value)"
                    :editable-schema="false"
                  />
                  <ScalarValue
                    v-else
                    :param-type="col.paramType"
                    :model-value="cellByPath(item, col.path).value"
                    @update:model-value="cellByPath(item, col.path).value = $event"
                  />
                </template>
                <span v-else class="hint">—</span>
              </td>
              <td v-if="!frame.single" class="operation-column">
                <div class="row-actions">
                  <ActionIconButton label="复制整行" :icon="Copy" @click="slDup(ri)" />
                  <ActionIconButton label="上移" :icon="ArrowUp" :disabled="ri === 0" @click="slMove(ri, -1)" />
                  <ActionIconButton label="下移" :icon="ArrowDown" :disabled="ri === slRows.length - 1" @click="slMove(ri, 1)" />
                  <ActionIconButton label="删除" :icon="Trash2" danger @click="slRemove(ri)" />
                </div>
              </td>
            </tr>
            <tr v-if="slRows.length === 0"><td :colspan="slFlatCols.length + 2" class="hint">空列表。</td></tr>
          </tbody>
        </table>

        <!-- 无定义时回退：按位置显示 -->
        <table v-else v-resizable-columns class="grid-table">
          <thead>
            <tr v-if="!frame.single">
              <th :colspan="slCols.length + 2" class="mode-header-cell">
                <div class="table-mode-header">
                  <span class="table-mode-meta">{{ slRows.length }} 项 · 按位置显示</span>
                  <n-button size="tiny" type="primary" @click="slMode = 'grid'">
                    <template #icon><Table2 :size="14" /></template>
                    表格
                  </n-button>
                  <n-button size="tiny" secondary @click="slGenTsv">
                    <template #icon><FileSpreadsheet :size="14" /></template>
                    批量文本
                  </n-button>
                </div>
              </th>
            </tr>
            <tr v-if="frame.single">
              <th :colspan="slCols.length" class="group-th struct-banner">⤷ {{ frame.label }}</th>
            </tr>
            <tr>
              <th v-if="!frame.single" style="width:34px">#</th>
              <th v-for="col in slCols" :key="col.i">{{ col.key }}<br /><span class="hint">{{ getTypeMeta(col.paramType).title }}</span></th>
              <th v-if="!frame.single" class="operation-column">操作</th>
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
                <FrameView
                  v-else-if="isComplexType(col.paramType) && slCell(item, col.i)"
                  :frame="buildInlineFrame(col.key, col.paramType, slCell(item, col.i).value)"
                  :editable-schema="false"
                />
                <ScalarValue
                  v-else-if="slCell(item, col.i)"
                  :param-type="col.paramType"
                  :model-value="slCell(item, col.i).value"
                  @update:model-value="slCell(item, col.i).value = $event"
                />
              </td>
              <td v-if="!frame.single" class="operation-column">
                <div class="row-actions">
                  <ActionIconButton label="复制整行" :icon="Copy" @click="slDup(ri)" />
                  <ActionIconButton label="上移" :icon="ArrowUp" :disabled="ri === 0" @click="slMove(ri, -1)" />
                  <ActionIconButton label="下移" :icon="ArrowDown" :disabled="ri === slRows.length - 1" @click="slMove(ri, 1)" />
                  <ActionIconButton label="删除" :icon="Trash2" danger @click="slRemove(ri)" />
                </div>
              </td>
            </tr>
            <tr v-if="slRows.length === 0"><td :colspan="slCols.length + 2" class="hint">空列表。</td></tr>
          </tbody>
        </table>
      </div>
      <n-button v-if="!frame.single" type="primary" size="small" style="margin-top:8px" @click="slAdd">
        <template #icon><Plus :size="15" /></template>
        添加项
      </n-button>
    </template>

    <div v-else>
      <div class="tsv-mode-header">
        <span class="table-mode-meta">{{ slRows.length }} 项</span>
        <n-button size="tiny" secondary @click="slMode = 'grid'">
          <template #icon><Table2 :size="14" /></template>
          表格
        </n-button>
        <n-button size="tiny" type="primary">
          <template #icon><FileSpreadsheet :size="14" /></template>
          批量文本
        </n-button>
      </div>
      <p class="hint">
        第一行为列名（只读参考）。每行一个结构体，列之间用 <b>Tab</b> 分隔，可从 Excel 整块粘贴/复制。
        嵌套的定长结构体已<b>拍平成点分列</b>（如 <code>需求货币.摩拉</code>）直接填值；
        列表字段与复合结构使用 JSON；文本中的 Tab、换行与引号会自动转义。
      </p>
      <textarea v-model="slText" class="tsv" style="min-height:320px"></textarea>
      <div v-if="tableError" class="error">{{ tableError }}</div>
      <div class="toolbar" style="margin-top:8px">
        <n-button type="primary" size="small" @click="slApplyTsv">应用文本</n-button>
        <n-button size="small" @click="slMode = 'grid'">取消</n-button>
      </div>
    </div>
  </div>

  <!-- ============ dict（键值表格） ============ -->
  <div v-else-if="frame.kind === 'dict'">
    <div class="toolbar">
      <n-button v-if="dictScalar" size="small" :type="dictMode === 'form' ? 'primary' : 'default'" :secondary="dictMode !== 'form'" @click="dictMode = 'form'">
        <template #icon><Table2 :size="15" /></template>
        表格
      </n-button>
      <n-button v-if="dictScalar" size="small" :type="dictMode === 'text' ? 'primary' : 'default'" :secondary="dictMode !== 'text'" @click="dictOpenText">
        <template #icon><FileSpreadsheet :size="15" /></template>
        批量文本
      </n-button>
      <span class="hint">键：{{ dictKeyType }} · 值：{{ dictValType }} · 共 {{ dictEntries.length }} 条</span>
    </div>

    <div v-if="dictMode === 'form'">
      <table v-resizable-columns class="grid-table">
        <thead><tr><th style="width:34px">#</th><th style="width:40%">键</th><th>值</th><th class="operation-column">操作</th></tr></thead>
        <tbody>
          <tr v-for="(entry, i) in dictEntries" :key="i">
            <td>{{ i }}</td>
            <td><ScalarValue :param-type="dictKeyType" :model-value="entry.key.value" @update:model-value="entry.key.value = $event" /></td>
            <td>
              <FrameView
                v-if="dictValComplex"
                :frame="buildInlineFrame('值', dictValType, entry.value.value)"
                :editable-schema="false"
              />
              <InlineList
                v-else-if="dictValList"
                :item-type="listElementType(dictValType)"
                :model-value="entry.value.value"
                @update:model-value="entry.value.value = $event"
              />
              <ScalarValue v-else :param-type="dictValType" :model-value="entry.value.value" @update:model-value="entry.value.value = $event" />
            </td>
            <td class="operation-column">
              <div class="row-actions">
                <ActionIconButton label="复制此条" :icon="Copy" @click="dictDup(i)" />
                <ActionIconButton label="上移" :icon="ArrowUp" :disabled="i === 0" @click="dictMove(i, -1)" />
                <ActionIconButton label="下移" :icon="ArrowDown" :disabled="i === dictEntries.length - 1" @click="dictMove(i, 1)" />
                <ActionIconButton label="删除" :icon="Trash2" danger @click="dictRemove(i)" />
              </div>
            </td>
          </tr>
          <tr v-if="dictEntries.length === 0"><td colspan="4" class="hint">空字典。</td></tr>
        </tbody>
      </table>
      <n-button type="primary" size="small" style="margin-top:8px" @click="dictAdd">
        <template #icon><Plus :size="15" /></template>
        添加条目
      </n-button>
    </div>

    <div v-else>
      <p class="hint">首行为“键 / 值”表头；可从 Excel 两列粘贴，Tab、换行与引号会自动转义。</p>
      <textarea v-model="dictText" style="min-height:280px"></textarea>
      <div v-if="tableError" class="error">{{ tableError }}</div>
      <div class="toolbar" style="margin-top:8px">
        <n-button type="primary" size="small" @click="dictApplyText">应用文本</n-button>
        <n-button size="small" @click="dictMode = 'form'">取消</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ref-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ref-row select { min-width: 120px; }

.mode-header-cell { padding: 6px 8px !important; background: rgba(45, 34, 72, 0.88); }
.table-mode-header,
.tsv-mode-header { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.table-mode-meta { margin-right: auto; color: var(--muted); font-size: 11px; font-weight: 500; }
.tsv-mode-header {
  margin-bottom: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(45, 34, 72, 0.72);
}

.complex-summary-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.complex-summary { color: var(--muted); font-size: 12px; }
.ref-name { color: var(--primary-hover); font-size: 12px; }
.expand-row > td { background: rgba(27, 20, 49, 0.78); padding: 7px 8px; }
.row-actions { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; }

.missing-struct-notice {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  margin-bottom: 6px; padding: 7px 9px; color: var(--warning);
  background: rgba(252, 211, 77, 0.07); border: 1px solid rgba(252, 211, 77, 0.3); border-radius: 7px;
  font-size: 11px;
}
.missing-struct-notice strong { color: #fde68a; font-weight: 600; }
.missing-struct-note { color: var(--muted); font-size: 10px; }

.grid-scroll { overflow-x: auto; background: rgba(18, 13, 34, 0.5); border-radius: 7px; }
.grid-table { border-collapse: collapse; width: 100%; background: rgba(18, 13, 34, 0.72); }
.grid-table th, .grid-table td { border: 1px solid rgba(112, 91, 146, 0.62); padding: 5px 7px; vertical-align: top; }
.grid-table th { color: var(--text-subtle); background: rgba(35, 26, 59, 0.94); font-size: 11px; font-weight: 600; text-align: left; white-space: nowrap; }
.grid-table > tbody > tr > td { background: rgba(24, 17, 42, 0.86); }
.grid-table > tbody > tr:nth-child(even) > td { background: rgba(29, 21, 49, 0.88); }
.col-leaf { display: block; color: var(--text); }
.col-type { display: block; font-weight: 400; }
.grid-table th.group-th { text-align: center; color: #ddd0ff; background: rgba(62, 48, 91, 0.94); border-bottom: 2px solid var(--primary); }
.struct-banner { text-align: left; }
.grid-table th.group-leaf { background: rgba(45, 34, 72, 0.92); }
.tsv { white-space: pre; overflow-wrap: normal; overflow-x: auto; }

@media (max-width: 760px) {
  .missing-struct-note { width: 100%; margin-left: 21px; }
}
</style>
