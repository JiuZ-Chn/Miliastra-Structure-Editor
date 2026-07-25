<script setup>
import { ref, computed } from 'vue'
import { Copy, FileSpreadsheet, Pencil, Plus, Table2, Trash2 } from '@lucide/vue'
import { NButton } from 'naive-ui'
import { useWorkspaceStore } from '../stores/workspace.js'
import {
  isListType,
  isComplexType,
  listElementType
} from '../lib/miliastra.js'
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
import FrameView from './FrameView.vue'

const store = useWorkspaceStore()

const def = computed(() => store.activeDefinition)
const cols = computed(() => (def.value?.fields ?? []).map((f, i) => ({ key: f.key, paramType: f.paramType, i })))
const rows = computed(() =>
  store.variables.filter((v) => v.defId === def.value?.id || v.structId === def.value?.structId)
)

function cell(v, i) {
  return v.fields[i] // { key, paramType, value }
}
function isCellComplex(paramType) {
  return isComplexType(paramType)
}
// 标量列表在单元格内联编辑；Vector3List 宽度有界(X/Y/Z)也可行内
function isInlineList(paramType) {
  return isListType(paramType)
}

function openVar(v) {
  store.selectVariable(v.id)
}

function buildInlineFrame(label, paramType, value) {
  if (paramType === 'Struct') {
    return {
      kind: 'structList',
      label,
      single: true,
      slVal: {
        structId: value?.structId ?? '',
        value: value ? [{ param_type: 'Struct', value }] : []
      }
    }
  }
  if (paramType === 'StructList') return { kind: 'structList', label, slVal: value }
  if (paramType === 'Dict') return { kind: 'dict', label, dictVal: value }
  return null
}

/* ---- TSV 批量 ---- */
const mode = ref('grid')
const text = ref('')
const tableError = ref('')
function genTsv() {
  const header = ['名称', ...cols.value.map((c) => c.key)]
  const lines = rows.value.map((v) =>
    [v.name, ...cols.value.map((c) => encodeTabularValue(c.paramType, cell(v, c.i)?.value))]
  )
  text.value = stringifyTsv([header, ...lines])
  tableError.value = ''
  mode.value = 'tsv'
}
function applyTsv() {
  try {
    const rows = parseTsv(text.value)
    assertHeader(rows[0] ?? [], ['名称', ...cols.value.map((column) => column.key)])
    const parsed = rows.slice(1)
      .filter((row) => row.some((cell) => cell !== ''))
      .map((cells) => ({
        name: cells[0] ?? '',
        values: cols.value.map((column, index) =>
          decodeTabularValue(column.paramType, cells[index + 1] ?? '')
        )
      }))
    store.rebuildVariablesForDefinition(def.value.id, parsed)
    tableError.value = ''
    mode.value = 'grid'
  } catch (error) {
    tableError.value = `无法应用 TSV：${error.message}`
  }
}
</script>

<template>
  <div v-if="def">
    <div class="toolbar">
      <n-button size="small" :type="mode === 'grid' ? 'primary' : 'default'" :secondary="mode !== 'grid'" @click="mode = 'grid'">
        <template #icon><Table2 :size="15" /></template>
        表格
      </n-button>
      <n-button size="small" :type="mode === 'tsv' ? 'primary' : 'default'" :secondary="mode !== 'tsv'" @click="genTsv">
        <template #icon><FileSpreadsheet :size="15" /></template>
        批量文本
      </n-button>
      <span class="hint">「{{ def.name }}」的全部变量 · 共 {{ rows.length }} 个</span>
      <span class="spacer"></span>
      <n-button type="primary" size="small" @click="store.addVariable(def.id)">
        <template #icon><Plus :size="15" /></template>
        新建变量
      </n-button>
    </div>

    <template v-if="mode === 'grid'">
      <div class="grid-scroll">
        <table v-resizable-columns class="grid-table">
          <thead>
            <tr>
              <th style="width:34px">#</th>
              <th style="min-width:120px">名称</th>
              <th v-for="col in cols" :key="col.i">{{ col.key }}<br /><span class="hint">{{ col.paramType }}</span></th>
              <th class="operation-column compact">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, ri) in rows" :key="v.id">
              <td>{{ ri }}</td>
              <td><input type="text" v-model="v.name" /></td>
              <td v-for="col in cols" :key="col.i">
                <InlineList
                  v-if="isInlineList(col.paramType) && cell(v, col.i)"
                  :item-type="listElementType(col.paramType)"
                  :model-value="cell(v, col.i).value"
                  @update:model-value="cell(v, col.i).value = $event"
                />
                <FrameView
                  v-else-if="isCellComplex(col.paramType) && cell(v, col.i)"
                  :frame="buildInlineFrame(col.key, col.paramType, cell(v, col.i).value)"
                  :editable-schema="false"
                />
                <ScalarValue
                  v-else-if="cell(v, col.i)"
                  :param-type="col.paramType"
                  :model-value="cell(v, col.i).value"
                  @update:model-value="cell(v, col.i).value = $event"
                />
              </td>
              <td class="operation-column compact">
                <div class="row-actions">
                  <ActionIconButton label="打开编辑" :icon="Pencil" @click="openVar(v)" />
                  <ActionIconButton label="复制变量" :icon="Copy" @click="store.duplicateVariable(v.id)" />
                  <ActionIconButton label="删除变量" :icon="Trash2" danger @click="store.removeVariable(v.id)" />
                </div>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td :colspan="cols.length + 3" class="hint">该定义还没有变量，点击右上「+ 新建变量」。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:8px">
        标量、列表、结构体、结构体列表与字典均直接在表内展开；数据量较大时可使用批量文本模式。
      </p>
    </template>

    <div v-else>
      <p class="hint">
        第一行为列名（只读参考）。每行一个变量：第一列是名称，其余列是字段值，用 <b>Tab</b> 分隔，可与 Excel 整块互贴。
        列表字段和嵌套结构使用 JSON；文本中的 Tab、换行与引号会自动转义。<b>应用后会重建该定义下的全部变量。</b>
      </p>
      <textarea v-model="text" class="tsv"></textarea>
      <div v-if="tableError" class="error">{{ tableError }}</div>
      <div class="toolbar" style="margin-top:8px">
        <n-button type="primary" size="small" @click="applyTsv">应用文本</n-button>
        <n-button size="small" @click="mode = 'grid'">取消</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spacer { flex: 1; }
.row-actions { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; }
.grid-scroll { overflow-x: auto; }
.grid-table { border-collapse: collapse; width: 100%; }
.grid-table th, .grid-table td { border: 1px solid var(--border); padding: 4px 6px; vertical-align: top; }
.grid-table th { color: var(--muted); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
.tsv { white-space: pre; overflow-wrap: normal; overflow-x: auto; min-height: 300px; }
</style>
