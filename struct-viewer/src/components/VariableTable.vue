<script setup>
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import {
  PARAM_TYPE_META,
  isListType,
  isComplexType,
  listElementType,
  defaultValueForType
} from '../lib/miliastra.js'
import ScalarValue from './ScalarValue.vue'
import InlineList from './InlineList.vue'

const store = useWorkspaceStore()

const def = computed(() => store.activeDefinition)
const cols = computed(() => (def.value?.fields ?? []).map((f, i) => ({ key: f.key, paramType: f.paramType, i })))
const rows = computed(() =>
  store.variables.filter((v) => v.defId === def.value?.id || v.structId === def.value?.structId)
)

function cell(v, i) {
  return v.fields[i] // { key, paramType, value }
}
function summarize(paramType, val) {
  if (isListType(paramType)) return `${Array.isArray(val) ? val.length : 0} 项`
  if (paramType === 'StructList') return `${val?.value?.length ?? 0} 项`
  if (paramType === 'Dict') return `${val?.value?.length ?? 0} 条`
  if (paramType === 'Struct') return `${val?.value?.length ?? 0} 字段`
  return ''
}
function isCellComplex(paramType) {
  return isComplexType(paramType) || isListType(paramType)
}
// 标量列表在单元格内联编辑；Vector3List 宽度有界(X/Y/Z)也可行内
function isInlineList(paramType) {
  return isListType(paramType)
}

function openVar(v) {
  store.selectVariable(v.id)
}

/* ---- TSV 批量 ---- */
const mode = ref('grid')
const text = ref('')
const COL = '\t'
const LIST = '|'
function serCell(paramType, value) {
  if (isListType(paramType)) return Array.isArray(value) ? value.join(LIST) : ''
  if (isComplexType(paramType)) return JSON.stringify(value ?? null)
  return value == null ? '' : String(value)
}
function parseCell(paramType, t) {
  if (isListType(paramType)) return t === '' ? [] : t.split(LIST)
  if (isComplexType(paramType)) {
    try {
      return JSON.parse(t)
    } catch {
      return JSON.parse(JSON.stringify(defaultValueForType(paramType)))
    }
  }
  return t
}
function genTsv() {
  const header = ['名称', ...cols.value.map((c) => c.key)].join(COL)
  const lines = rows.value.map((v) =>
    [v.name, ...cols.value.map((c) => serCell(c.paramType, cell(v, c.i)?.value))].join(COL)
  )
  text.value = [header, ...lines].join('\n')
  mode.value = 'tsv'
}
function applyTsv() {
  const lines = text.value.split('\n').slice(1) // 跳过表头
  const parsed = lines
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const cells = line.split(COL)
      return {
        name: (cells[0] ?? '').trim(),
        values: cols.value.map((c, ci) => parseCell(c.paramType, (cells[ci + 1] ?? '').trim()))
      }
    })
  store.rebuildVariablesForDefinition(def.value.id, parsed)
  mode.value = 'grid'
}
</script>

<template>
  <div v-if="def">
    <div class="toolbar">
      <button :class="{ primary: mode === 'grid' }" @click="mode = 'grid'">表格</button>
      <button :class="{ primary: mode === 'tsv' }" @click="genTsv">批量文本(TSV)</button>
      <span class="hint">「{{ def.name }}」的全部变量 · 共 {{ rows.length }} 个</span>
      <span class="spacer"></span>
      <button class="primary" @click="store.addVariable(def.id)">+ 新建变量</button>
    </div>

    <template v-if="mode === 'grid'">
      <div class="grid-scroll">
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:34px">#</th>
              <th style="min-width:120px">名称</th>
              <th v-for="col in cols" :key="col.i">{{ col.key }}<br /><span class="hint">{{ col.paramType }}</span></th>
              <th style="width:150px">操作</th>
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
                <button v-else-if="isCellComplex(col.paramType)" class="enter-btn small" @click="openVar(v)">
                  {{ summarize(col.paramType, cell(v, col.i)?.value) }} ▸
                </button>
                <ScalarValue
                  v-else-if="cell(v, col.i)"
                  :param-type="col.paramType"
                  :model-value="cell(v, col.i).value"
                  @update:model-value="cell(v, col.i).value = $event"
                />
              </td>
              <td>
                <button class="ghost icon-btn" title="打开编辑" @click="openVar(v)">✎</button>
                <button class="ghost icon-btn" title="复制此变量" @click="store.duplicateVariable(v.id)">⧉</button>
                <button class="ghost icon-btn danger" title="删除" @click="store.removeVariable(v.id)">✕</button>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td :colspan="cols.length + 3" class="hint">该定义还没有变量，点击右上「+ 新建变量」。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:8px">
        标量字段可直接在表内编辑；复杂字段点「进入 ▸」打开该变量单独编辑。含嵌套的列表字段建议用「批量文本(TSV)」或打开单个变量。
      </p>
    </template>

    <div v-else>
      <p class="hint">
        第一行为列名（只读参考）。每行一个变量：第一列是名称，其余列是字段值，用 <b>Tab</b> 分隔，可与 Excel 整块互贴。
        列表字段用 <b>|</b> 分隔多值；嵌套结构体/字典以 JSON 表示。<b>应用后会重建该定义下的全部变量。</b>
      </p>
      <textarea v-model="text" class="tsv"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="primary" @click="applyTsv">应用文本</button>
        <button @click="mode = 'grid'">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spacer { flex: 1; }
.enter-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; cursor: pointer; color: var(--text); font-size: 12px; }
.enter-btn:hover { border-color: var(--primary); }
.grid-scroll { overflow-x: auto; }
.grid-table { border-collapse: collapse; width: 100%; }
.grid-table th, .grid-table td { border: 1px solid var(--border); padding: 4px 6px; vertical-align: top; }
.grid-table th { color: var(--muted); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
.tsv { white-space: pre; overflow-wrap: normal; overflow-x: auto; min-height: 300px; }
</style>
