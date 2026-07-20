<script setup>
import { ref, computed, watch } from 'vue'
import { Braces, Check, Code2, Copy, RotateCcw, Table2 } from '@lucide/vue'
import { NButton, NInput, NTag } from 'naive-ui'
import { useWorkspaceStore } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'
import FrameView from './FrameView.vue'
import VariableTable from './VariableTable.vue'

const store = useWorkspaceStore()

const target = computed(() => store.editingTarget)
const isDefinition = computed(() => store.editing === 'definition')
const isVariable = computed(() => store.editing === 'variable')

// 定义视图：schema（结构）/ table（变量表）
const defView = ref('schema')
watch(() => [store.editing, target.value?.id], () => { defView.value = 'schema' })

const currentFrame = computed(() => {
  const t = target.value
  if (!t) return null
  return {
    kind: 'struct',
    label: t.name,
    rootFields: t.fields,
    isRoot: true
  }
})

// ---- structId 数字限制 ----
function onStructIdInput(val) {
  if (target.value) store.setDefinitionStructId(target.value.id, val)
}

// ---- 深度变更自动持久化 ----
watch(() => store.workspaces, () => store.persist(), { deep: true })

// ---- 底部整体 JSON（可编辑并反向应用）----
const jsonPreview = computed(() => {
  if (!target.value) return ''
  const obj = isDefinition.value
    ? store.exportDefinition(target.value.id)
    : store.exportVariable(target.value.id)
  return obj ? toJSON(obj) : ''
})
const jsonEdit = ref('')
const jsonDirty = ref(false)
const jsonError = ref('')
const jsonOpen = ref(false)
watch(jsonPreview, (v) => { if (!jsonDirty.value) jsonEdit.value = v }, { immediate: true })
function onJsonInput(v) { jsonEdit.value = v; jsonDirty.value = true }
function applyJson() {
  jsonError.value = ''
  try {
    if (isDefinition.value) store.applyJsonToDefinition(target.value.id, jsonEdit.value)
    else store.applyJsonToVariable(target.value.id, jsonEdit.value)
    jsonDirty.value = false
  } catch (e) {
    jsonError.value = e.message
  }
}
function resetJson() { jsonEdit.value = jsonPreview.value; jsonDirty.value = false; jsonError.value = '' }
async function copyJson() {
  try { await navigator.clipboard.writeText(jsonEdit.value); store.message = '已复制到剪贴板' }
  catch { store.message = '复制失败，请手动复制' }
}
</script>

<template>
  <div v-if="target" class="editor">
    <div class="editor-head">
      <n-tag round :type="isDefinition ? 'info' : 'success'" size="small">
        {{ isDefinition ? '结构体定义' : '结构体变量' }}
      </n-tag>
      <label class="inline">
        <span>名称</span>
        <n-input v-model:value="target.name" size="small" style="width: 180px" />
      </label>
      <label class="inline">
        <span>结构体索引</span>
        <n-input
          v-if="isDefinition"
          size="small"
          style="width: 130px"
          :value="target.structId"
          :status="!target.structId ? 'error' : undefined"
          placeholder="仅数字"
          @update:value="onStructIdInput"
        />
        <n-tag v-else size="small" title="变量的结构体索引绑定结构体定义，不可修改">
          {{ target.structId }}（绑定定义）
        </n-tag>
      </label>
      <span v-if="isDefinition && !target.structId" class="need-hint">⚠ 请为该结构体填写 结构体索引（数字）</span>
    </div>

    <!-- 定义视图切换：结构 / 变量表 -->
    <div v-if="isDefinition" class="view-tabs">
      <n-button
        size="small"
        :type="defView === 'schema' ? 'primary' : 'default'"
        :secondary="defView !== 'schema'"
        @click="defView = 'schema'"
      >
        <template #icon><Braces :size="15" /></template>
        结构定义
      </n-button>
      <n-button
        size="small"
        :type="defView === 'table' ? 'primary' : 'default'"
        :secondary="defView !== 'table'"
        @click="defView = 'table'"
      >
        <template #icon><Table2 :size="15" /></template>
        变量表（{{ store.variables.filter((v) => v.defId === target.id || v.structId === target.structId).length }}）
      </n-button>
    </div>

    <!-- 变量表视图（方法二：一张表批量编辑该定义的全部变量） -->
    <div v-if="isDefinition && defView === 'table'" class="frame-scroll">
      <VariableTable />
    </div>

    <!-- 结构/变量编辑视图：复杂值递归直接展开 -->
    <template v-else>
      <div class="frame-scroll">
        <FrameView
          v-if="currentFrame"
          :frame="currentFrame"
          :editable-schema="isDefinition && currentFrame.isRoot === true"
        />
      </div>
    </template>

    <!-- 底部整体 JSON -->
    <div class="json-bar">
      <n-button text @click="jsonOpen = !jsonOpen">
        <template #icon><Code2 :size="15" /></template>
        {{ jsonOpen ? '▾' : '▸' }} 整体 JSON（{{ isDefinition ? '结构体定义' : '结构体变量' }}）
        <n-tag v-if="jsonDirty" size="small" type="error" round style="margin-left:6px">未应用</n-tag>
      </n-button>
      <div v-if="jsonOpen" class="json-card">
        <n-input
          type="textarea"
          :rows="14"
          :value="jsonEdit"
          @update:value="onJsonInput"
        />
        <div class="toolbar" style="margin-top:8px">
          <n-button type="primary" size="small" @click="applyJson" :disabled="!jsonDirty">
            <template #icon><Check :size="15" /></template>
            应用修改
          </n-button>
          <n-button size="small" @click="resetJson" :disabled="!jsonDirty">
            <template #icon><RotateCcw :size="15" /></template>
            还原
          </n-button>
          <n-button size="small" @click="copyJson">
            <template #icon><Copy :size="15" /></template>
            复制
          </n-button>
        </div>
        <div v-if="jsonError" class="error">{{ jsonError }}</div>
        <p class="hint">整体 JSON 适合大批量修改：可整段粘贴替换，点击“应用修改”原地更新当前{{ isDefinition ? '定义' : '变量' }}。</p>
      </div>
    </div>
  </div>

  <div v-else class="editor empty-editor">
    <p class="hint">从「高级数据管理」选择结构体定义，或从「自定义变量」选择变量开始编辑。</p>
  </div>
</template>

<style scoped>
.editor { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.empty-editor { display: flex; align-items: center; justify-content: center; padding: 16px; }
.editor-head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 14px 16px 8px; }
.inline { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.need-hint { color: var(--danger); font-size: 12px; }

.view-tabs { display: flex; gap: 6px; padding: 4px 16px 10px; border-bottom: 1px solid var(--border); }

.frame-scroll { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px; }

.json-bar { border-top: 1px solid var(--border); padding: 8px 16px; background: var(--panel); }
.json-card { margin-top: 8px; }
</style>
