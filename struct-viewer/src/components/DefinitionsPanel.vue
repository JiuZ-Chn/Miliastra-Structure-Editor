<script setup>
import { ref } from 'vue'
import { useWorkspaceStore, SAMPLES } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'

const store = useWorkspaceStore()
const importOpen = ref(false)
const importText = ref('')
const error = ref('')
const fileInput = ref(null)

function doImport() {
  error.value = ''
  try {
    store.importDefinition(importText.value)
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
      store.importDefinition(text)
    } catch (err) {
      error.value = `${file.name}: ${err.message}`
    }
  }
  e.target.value = ''
}

function exportDef(id) {
  const obj = store.exportDefinition(id)
  if (!obj) return
  const text = toJSON(obj)
  const def = store.definitions.find((d) => d.id === id)
  download(text, (def?.name || 'struct') + '.json')
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
</script>

<template>
  <div class="col">
    <div class="col-head">
      <h2>高级数据管理</h2>
      <span class="hint">当前存档内的结构体定义</span>
    </div>

    <div class="col-body">
      <div
        v-for="d in store.definitions"
        :key="d.id"
        class="list-item"
        :class="{ active: store.editing === 'definition' && d.id === store.activeDefId }"
        @click="store.selectDefinition(d.id)"
      >
        <div class="list-item-main">
          <div class="name">{{ d.name }}</div>
          <div class="meta">{{ d.fields.length }} 字段 · id {{ d.structId }}</div>
        </div>
        <div class="list-item-ops">
          <button class="ghost icon-btn" title="导出" @click.stop="exportDef(d.id)">⬇</button>
          <button class="ghost icon-btn primary-plus" title="新建变量" @click.stop="store.addVariable(d.id)">+变量</button>
          <button class="ghost icon-btn danger" title="删除" @click.stop="store.removeDefinition(d.id)">✕</button>
        </div>
      </div>
      <div v-if="store.definitions.length === 0" class="empty">
        暂无结构体定义，点击下方“新建 / 导入 / 示例”。
      </div>
    </div>

    <div class="col-foot">
      <button class="primary" @click="store.addDefinition()">+ 新建</button>
      <button @click="pickFile">从文件导入</button>
      <button @click="importOpen = !importOpen">从 JSON 导入</button>
      <select
        @change="store.loadSample($event.target.value); $event.target.value = ''"
        style="max-width:120px"
      >
        <option value="">加载示例…</option>
        <option v-for="s in SAMPLES" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        multiple
        style="display:none"
        @change="onFileChange"
      />
    </div>

    <div v-if="importOpen" class="import-box">
      <textarea v-model="importText" placeholder='粘贴“结构体”定义 JSON'></textarea>
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
.primary-plus { color: var(--primary); }
.empty { color: var(--muted); font-size: 12px; padding: 12px; }
.import-box { padding: 8px; border-top: 1px solid var(--border); }
.import-box textarea { min-height: 120px; }
</style>
