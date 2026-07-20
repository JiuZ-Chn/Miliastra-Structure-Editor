<script setup>
import { ref } from 'vue'
import { Braces, Download, FilePlus2, FileUp, Plus, Trash2 } from '@lucide/vue'
import { NButton, NInput } from 'naive-ui'
import { useWorkspaceStore } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'
import ActionIconButton from './ActionIconButton.vue'

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
          <div class="meta">{{ d.fields.length }} 字段 · 索引 {{ d.structId }}</div>
        </div>
        <div class="list-item-ops">
          <ActionIconButton label="导出定义" :icon="Download" compact @click.stop="exportDef(d.id)" />
          <ActionIconButton label="基于此定义新建变量" :icon="FilePlus2" compact primary @click.stop="store.addVariable(d.id)" />
          <ActionIconButton label="删除定义" :icon="Trash2" compact danger @click.stop="store.removeDefinition(d.id)" />
        </div>
      </div>
      <div v-if="store.definitions.length === 0" class="empty">
        暂无结构体定义，点击下方“新建 / 导入”。
      </div>
    </div>

    <div class="col-foot">
      <n-button type="primary" size="small" @click="store.addDefinition()">
        <template #icon><Plus :size="15" /></template>
        新建
      </n-button>
      <n-button size="small" @click="pickFile">
        <template #icon><FileUp :size="15" /></template>
        文件导入
      </n-button>
      <n-button size="small" @click="importOpen = !importOpen">
        <template #icon><Braces :size="15" /></template>
        JSON 导入
      </n-button>
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
      <n-input
        v-model:value="importText"
        type="textarea"
        :rows="6"
        placeholder='粘贴“结构体”定义 JSON'
      />
      <div class="toolbar" style="margin-top:8px">
        <n-button type="primary" size="small" @click="doImport">导入</n-button>
        <n-button size="small" @click="importOpen = false">取消</n-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.col { display: flex; flex-direction: column; height: 100%; border-right: 1px solid var(--border); background: rgba(255, 255, 255, 0.012); }
.col-head { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.col-head h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.02em; }
.col-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
.col-foot { padding: 8px; border-top: 1px solid var(--border); display: flex; gap: 6px; flex-wrap: wrap; }
.list-item { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; transition: background 0.15s, border-color 0.15s; }
.list-item::before { content: ""; position: absolute; left: 4px; top: 50%; transform: translateY(-50%); width: 3px; height: 0; border-radius: 3px; background: var(--primary); transition: height 0.18s; }
.list-item:hover { background: rgba(255, 255, 255, 0.04); }
.list-item.active { background: var(--primary-2); border-color: rgba(124, 108, 255, 0.35); }
.list-item.active::before { height: 60%; }
.list-item .name { font-size: 14px; }
.list-item .meta { font-size: 11px; color: var(--muted); }
.list-item-ops { display: flex; gap: 2px; align-items: center; }
.empty { color: var(--muted); font-size: 12px; padding: 12px; }
.import-box { padding: 8px; border-top: 1px solid var(--border); }
</style>
