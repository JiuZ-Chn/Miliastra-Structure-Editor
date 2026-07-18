<script setup>
import { ref, computed, inject } from 'vue'
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

// 允许在“表单视图”里递归渲染自身
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

function buildChildFrame(label, paramType, val) {
  if (paramType === 'Struct') {
    return { kind: 'struct', label, structObj: val, keys: resolveKeys(val?.structId) }
  }
  if (paramType === 'StructList') {
    return { kind: 'structList', label, slVal: val }
  }
  if (paramType === 'Dict') {
    return { kind: 'dict', label, dictVal: val }
  }
  // 标量列表
  return { kind: 'scalarList', label, arr: val, itemType: listElementType(paramType) }
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

/* ---------------- scalarList 帧 ---------------- */
const listMode = ref('form') // form | text
const listText = ref('')
function openText() {
  listText.value = (props.frame.arr ?? []).join('\n')
  listMode.value = 'text'
}
function applyText() {
  const lines = listText.value.split('\n')
  props.frame.arr.splice(0, props.frame.arr.length, ...lines)
  listMode.value = 'form'
}
function addListItem() {
  props.frame.arr.push(props.frame.itemType === 'Vector3' ? '0,0,0' : defaultValueForType(props.frame.itemType))
}
function removeListItem(i) {
  props.frame.arr.splice(i, 1)
}
function dupListItem(i) {
  props.frame.arr.splice(i + 1, 0, props.frame.arr[i])
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
function slNewItem() {
  const def = slDef.value
  const struct = def
    ? blankStructValue(def)
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
const slMode = ref('grid') // grid | form | tsv
const slText = ref('')

/* structList 表单视图：一次一个项，字段竖排（与外层结构体一致），可翻页 */
const slFormIdx = ref(0)
const slFormFrame = computed(() => {
  const item = slRows.value[slFormIdx.value]
  if (!item) return null
  return {
    kind: 'struct',
    label: `[${slFormIdx.value}]`,
    structObj: item.value,
    keys: resolveKeys(props.frame.slVal?.structId)
  }
})
function slFormGo(delta) {
  const n = slRows.value.length
  if (n === 0) return
  slFormIdx.value = Math.min(Math.max(0, slFormIdx.value + delta), n - 1)
}
function slOpenForm(idx) {
  slFormIdx.value = idx
  slMode.value = 'form'
}
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
  const cols = slCols.value
  const header = cols.map((c) => c.key).join(COL_DELIM)
  const lines = slRows.value.map((item) =>
    cols.map((c) => serCell(c.paramType, slCell(item, c.i)?.value)).join(COL_DELIM)
  )
  slText.value = [header, ...lines].join('\n')
  slMode.value = 'tsv'
}
function slApplyTsv() {
  const cols = slCols.value
  const rows = slText.value.split('\n')
  // 跳过第一行表头
  const body = rows.slice(1).filter((l, i) => l.trim() !== '' || i < rows.length - 1)
  const items = body
    .filter((l) => l.trim() !== '')
    .map((line) => {
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
const dictValComplex = computed(() => isComplexType(dictValType.value) || isListType(dictValType.value))
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
function dictEnterValue(entry) {
  navigate(buildChildFrame('值', dictValType.value, entry.value.value))
}

// 简单标量字典的批量文本（key<TAB>value 每行一条）
const dictScalar = computed(() => !dictValComplex.value)
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
        <tr v-for="row in structRows" :key="row.i">
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
            <!-- 定义模式：Struct / StructList 只需声明“引用哪个结构体”，默认值自动生成 -->
            <div v-if="editableSchema && (row.paramType === 'Struct' || row.paramType === 'StructList')" class="ref-row">
              <span class="hint">包含结构体</span>
              <select :value="refStructId(row)" @change="setStructRef(row, $event.target.value)">
                <option value="">（选择结构体定义）</option>
                <option v-for="d in refDefs" :key="d.id" :value="d.structId">
                  {{ d.name }}（{{ d.structId || '未设ID' }}）
                </option>
              </select>
              <button class="enter-btn small" @click="enterField(row)">编辑默认 ▸ {{ summarize(row.paramType, row.ref.value) }}</button>
            </div>

            <!-- 定义模式：Dict 声明 键/值 类型 -->
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
              <button class="enter-btn small" @click="enterField(row)">编辑默认 ▸ {{ summarize('Dict', row.ref.value) }}</button>
            </div>

            <!-- 变量模式 / 标量列表：进入编辑 -->
            <button
              v-else-if="isComplexType(row.paramType) || isListType(row.paramType)"
              class="enter-btn"
              @click="enterField(row)"
            >
              <span class="chip">{{ getTypeMeta(row.paramType).title }}</span>
              <span class="summary">{{ summarize(row.paramType, row.ref.value) }}</span>
              <span class="arrow">进入 ▸</span>
            </button>
            <ScalarValue v-else :param-type="row.paramType" v-model="row.ref.value" />
          </td>
          <td v-if="editableSchema">
            <button class="ghost icon-btn" @click="moveField(row.i, -1)" :disabled="row.i === 0">↑</button>
            <button class="ghost icon-btn" @click="moveField(row.i, 1)" :disabled="row.i === structRows.length - 1">↓</button>
            <button class="ghost icon-btn danger" @click="removeField(row.i)">✕</button>
          </td>
        </tr>
        <tr v-if="structRows.length === 0"><td :colspan="editableSchema ? 5 : 4" class="hint">暂无字段。</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ============ scalarList ============ -->
  <div v-else-if="frame.kind === 'scalarList'">
    <div class="toolbar">
      <button :class="{ primary: listMode === 'form' }" @click="listMode = 'form'">表单</button>
      <button :class="{ primary: listMode === 'text' }" @click="openText">批量文本</button>
      <span class="hint">元素类型：{{ typeLabel(frame.itemType) }} · 共 {{ frame.arr.length }} 项</span>
    </div>

    <div v-if="listMode === 'form'">
      <table class="field-table">
        <thead><tr><th style="width:40px">#</th><th>值</th><th style="width:110px">操作</th></tr></thead>
        <tbody>
          <tr v-for="(item, i) in frame.arr" :key="i">
            <td>{{ i }}</td>
            <td><ScalarValue :param-type="frame.itemType" :model-value="frame.arr[i]" @update:model-value="frame.arr[i] = $event" /></td>
            <td>
              <button class="ghost icon-btn" title="复制此项" @click="dupListItem(i)">⧉</button>
              <button class="ghost icon-btn danger" @click="removeListItem(i)">✕</button>
            </td>
          </tr>
          <tr v-if="frame.arr.length === 0"><td colspan="3" class="hint">空列表。</td></tr>
        </tbody>
      </table>
      <button class="primary" style="margin-top:8px" @click="addListItem">+ 添加项</button>
    </div>

    <div v-else>
      <p class="hint">每行一项，可整段从 Excel/记事本粘贴或复制。</p>
      <textarea v-model="listText" style="min-height:280px"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="primary" @click="applyText">应用文本</button>
        <button @click="listMode = 'form'">取消</button>
      </div>
    </div>
  </div>

  <!-- ============ structList（表格 / 表单 / TSV） ============ -->
  <div v-else-if="frame.kind === 'structList'">
    <div class="toolbar">
      <button :class="{ primary: slMode === 'grid' }" @click="slMode = 'grid'">表格</button>
      <button :class="{ primary: slMode === 'form' }" @click="slMode = 'form'">表单</button>
      <button :class="{ primary: slMode === 'tsv' }" @click="slGenTsv">批量文本(TSV)</button>
      <span class="hint">
        结构体列表 · 共 {{ slRows.length }} 项
        <template v-if="slDef">· 绑定定义「{{ slDef.name }}」</template>
        <template v-else>· 未找到 structId={{ frame.slVal.structId }} 的定义，按位置显示</template>
      </span>
    </div>

    <template v-if="slMode === 'grid'">
      <div class="grid-scroll">
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:34px">#</th>
              <th v-for="col in slCols" :key="col.i">{{ col.key }}<br /><span class="hint">{{ col.paramType }}</span></th>
              <th style="width:130px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, ri) in slRows" :key="ri">
              <td>{{ ri }}</td>
              <td v-for="col in slCols" :key="col.i">
                <button
                  v-if="isComplexType(col.paramType) || isListType(col.paramType)"
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
              <td>
                <button class="ghost icon-btn" title="表单编辑此项" @click="slOpenForm(ri)">✎</button>
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
      <button class="primary" style="margin-top:8px" @click="slAdd">+ 添加项</button>
    </template>

    <!-- 表单视图：一次一个项，字段竖排（与外层结构体一致），可翻页 -->
    <template v-else-if="slMode === 'form'">
      <div v-if="slRows.length === 0" class="hint">空列表。<button class="primary" style="margin-left:8px" @click="slAdd">+ 添加项</button></div>
      <template v-else>
        <div class="form-pager">
          <button class="ghost" @click="slFormGo(-1)" :disabled="slFormIdx === 0">‹ 上一项</button>
          <span class="hint">第 {{ slFormIdx + 1 }} / {{ slRows.length }} 项</span>
          <button class="ghost" @click="slFormGo(1)" :disabled="slFormIdx === slRows.length - 1">下一项 ›</button>
          <span class="spacer"></span>
          <button class="ghost icon-btn" title="复制此项" @click="slDup(slFormIdx)">⧉ 复制</button>
          <button class="ghost icon-btn danger" title="删除此项" @click="slRemove(slFormIdx); slFormGo(0)">✕ 删除</button>
          <button class="primary" @click="slAdd">+ 添加项</button>
        </div>
        <div class="form-item">
          <FrameView v-if="slFormFrame" :frame="slFormFrame" :editable-schema="false" />
        </div>
      </template>
    </template>

    <div v-else>
      <p class="hint">
        第一行为列名（只读参考）。每行一个结构体，列之间用 <b>Tab</b> 分隔，可从 Excel 整块粘贴/复制。
        列表字段用 <b>|</b> 分隔多个值（如 <code>1|2|3</code>）；嵌套结构体/字典以 JSON 表示。
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
      <button :class="{ primary: dictMode === 'form' }" @click="dictMode = 'form'">表单</button>
      <button v-if="dictScalar" :class="{ primary: dictMode === 'text' }" @click="dictOpenText">批量文本</button>
      <span class="hint">键：{{ dictKeyType }} · 值：{{ dictValType }} · 共 {{ dictEntries.length }} 条</span>
    </div>

    <div v-if="dictMode === 'form'">
      <table class="grid-table">
        <thead><tr><th style="width:34px">#</th><th style="width:40%">键</th><th>值</th><th style="width:60px">操作</th></tr></thead>
        <tbody>
          <tr v-for="(entry, i) in dictEntries" :key="i">
            <td>{{ i }}</td>
            <td><ScalarValue :param-type="dictKeyType" :model-value="entry.key.value" @update:model-value="entry.key.value = $event" /></td>
            <td>
              <button v-if="dictValComplex" class="enter-btn small" @click="dictEnterValue(entry)">
                {{ summarize(dictValType, entry.value.value) }} ▸
              </button>
              <ScalarValue v-else :param-type="dictValType" :model-value="entry.value.value" @update:model-value="entry.value.value = $event" />
            </td>
            <td><button class="ghost icon-btn danger" @click="dictRemove(i)">✕</button></td>
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

.form-pager { display: flex; align-items: center; gap: 10px; padding: 6px 0 10px; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.form-item { padding-left: 2px; }

.grid-scroll { overflow-x: auto; }
.grid-table { border-collapse: collapse; width: 100%; }
.grid-table th, .grid-table td { border: 1px solid var(--border); padding: 4px 6px; vertical-align: top; }
.grid-table th { color: var(--muted); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
.tsv { white-space: pre; overflow-wrap: normal; overflow-x: auto; }
</style>
