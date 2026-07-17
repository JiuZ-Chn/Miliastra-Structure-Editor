<script setup>
import { ref } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'

const store = useWorkspaceStore()
const importOpen = ref(false)
const importText = ref('')
const error = ref('')
const pickDefOpen = ref(false)
const fileInput = ref(null)

function doImport() {
  error.value = ''
  try {
    store.importVariable(importText.value)
    importText.value = ''
    importOpen.value = false
  } catch (e) {
    error.value = e.message
  }
}

function pickFile() {
  fileInput.value?.click()
}
async function onFileChange(e) {
  const files = Array.from(e.target.files || [])
  error.value = ''
  for (const file of files) {
    try {
      const text = await file.text()
      store.importVariable(text)
    } catch (err) {
      error.value = `${file.name}: ${err.message}`
      importOpen.value = true
    }
  }
  e.target.value = ''
}

function exportVar(id) {
  const obj = store.exportVariable(id)
  if (!obj) return
  const v = store.variables.find((x) => x.id === id)
  download(toJSON(obj), (v?.name || 'variable') + '.json')
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function createFromDef(defId) {
  store.addVariable(defId)
  pickDefOpen.value = false
}
</script>

<template>
  <div class="col">
    <div class="col-head">
      <h2>自定义变量</h2>
      <span class="hint">基于结构体定义的变量实例</span>
    </div>

    <div class="col-body">
      <div
        v-for="v in store.variables"
        :key="v.id"
        class="list-item"
        :class="{ active: store.editing === 'variable' && v.id === store.activeVariableId }"
        @click="store.selectVariable(v.id)"
      >
        <div class="list-item-main">
          <div class="name">{{ v.name }}</div>
          <div class="meta">{{ v.fields.length }} 值 · id {{ v.structId }}</div>
        </div>
        <div class="list-item-ops">
          <button class="ghost icon-btn" title="导出" @click.stop="exportVar(v.id)">⬇</button>
          <button class="ghost icon-btn danger" title="删除" @click.stop="store.removeVariable(v.id)">✕</button>
        </div>
      </div>
      <div v-if="store.variables.length === 0" class="empty">
        暂无变量，点击下方“新建变量”基于某个结构体定义创建。
      </div>
    </div>

    <div class="col-foot">
      <button class="primary" @click="pickDefOpen = !pickDefOpen">+ 新建变量</button>
      <button @click="pickFile">从文件</button>
      <button @click="importOpen = !importOpen">粘贴</button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        multiple
        style="display:none"
        @change="onFileChange"
      />
    </div>

    <div v-if="pickDefOpen" class="import-box">
      <div class="hint" style="margin-bottom:6px">选择基于的结构体定义：</div>
      <button
        v-for="d in store.definitions"
        :key="d.id"
        class="ghost"
        style="width:100%; text-align:left; margin-bottom:4px"
        @click="createFromDef(d.id)"
      >
        {{ d.name }}（id {{ d.structId }}）
      </button>
      <div v-if="store.definitions.length === 0" class="error">当前存档没有结构体定义，请先在“高级数据管理”创建。</div>
    </div>

    <div v-if="importOpen" class="import-box">
      <textarea v-model="importText" placeholder='粘贴“结构体变量”JSON'></textarea>
      <div class="toolbar">
        <button class="primary" @click="doImport">导入</button>
        <button @click="importOpen = false">取消</button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.col { display: flex; flex-direction: column; height: 100%; border-right: 1px solid var(--border); }
.col-head { padding: 12px; border-bottom: 1px solid var(--border); }
.col-head h2 { margin: 0; font-size: 14px; }
.col-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
.col-foot { padding: 8px; border-top: 1px solid var(--border); display: flex; gap: 6px; flex-wrap: wrap; }
.list-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.list-item:hover { background: var(--panel-2); }
.list-item.active { background: var(--panel-2); border-color: var(--primary); }
.list-item .name { font-size: 14px; }
.list-item .meta { font-size: 11px; color: var(--muted); }
.list-item-ops { display: flex; gap: 2px; align-items: center; }
.empty { color: var(--muted); font-size: 12px; padding: 12px; }
.import-box { padding: 8px; border-top: 1px solid var(--border); }
.import-box textarea { min-height: 120px; }
</style>
