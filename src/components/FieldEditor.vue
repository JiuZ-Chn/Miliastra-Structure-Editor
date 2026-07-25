<script setup>
import { ref, computed, watch } from 'vue'
import { AlertTriangle, Braces, Check, ChevronDown, ChevronRight, Code2, Copy, RotateCcw, Table2 } from '@lucide/vue'
import { NButton, NInput, NTag } from 'naive-ui'
import { useWorkspaceStore } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'
import FrameView from './FrameView.vue'
import VariableTable from './VariableTable.vue'

const store = useWorkspaceStore()

const target = computed(() => store.editingTarget)
const isDefinition = computed(() => store.editing === 'definition')
const isVariable = computed(() => store.editing === 'variable')
const boundVariableCount = computed(() => {
  if (!target.value || !isDefinition.value) return 0
  return store.variables.filter((variable) => (
    variable.defId === target.value.id || variable.structId === target.value.structId
  )).length
})

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
      <div class="editor-identity">
        <span class="editor-type-icon" :class="{ variable: isVariable }" aria-hidden="true">
          <component :is="isDefinition ? Braces : Table2" :size="18" />
        </span>
        <strong>{{ isDefinition ? '结构体定义' : '结构体变量' }}</strong>
      </div>

      <div class="editor-meta-fields">
        <label class="inline">
          <span>名称</span>
          <n-input v-model:value="target.name" class="name-input" size="small" />
        </label>
        <label class="inline">
          <span>结构体索引</span>
          <n-input
            v-if="isDefinition"
            class="struct-id-input"
            size="small"
            :value="target.structId"
            :status="!target.structId ? 'error' : undefined"
            placeholder="仅数字"
            @update:value="onStructIdInput"
          />
          <n-tag v-else class="bound-tag" size="small" title="变量的结构体索引绑定结构体定义，不可修改">
            {{ target.structId }} · 已绑定
          </n-tag>
        </label>
      </div>

      <span v-if="isDefinition && !target.structId" class="need-hint">
        <AlertTriangle :size="14" />
        请填写结构体索引
      </span>
    </div>

    <!-- 定义视图切换：结构 / 变量表 -->
    <div v-if="isDefinition" class="view-tabs" role="tablist" aria-label="结构体视图">
      <button
        type="button"
        class="view-tab"
        :class="{ active: defView === 'schema' }"
        role="tab"
        :aria-selected="defView === 'schema'"
        @click="defView = 'schema'"
      >
        <Braces :size="15" />
        结构定义
      </button>
      <button
        type="button"
        class="view-tab"
        :class="{ active: defView === 'table' }"
        role="tab"
        :aria-selected="defView === 'table'"
        @click="defView = 'table'"
      >
        <Table2 :size="15" />
        变量表
        <span class="tab-count">{{ boundVariableCount }}</span>
      </button>
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
      <n-button class="json-toggle" text @click="jsonOpen = !jsonOpen">
        <template #icon><Code2 :size="15" /></template>
        整体 JSON
        <component :is="jsonOpen ? ChevronDown : ChevronRight" :size="14" />
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
    <div class="empty-editor-state">
      <span aria-hidden="true"><Braces :size="26" /></span>
      <strong>未选择编辑对象</strong>
      <p>从结构体定义或自定义变量列表中选择一项</p>
    </div>
  </div>
</template>

<style scoped>
.editor { height: 100%; min-height: 0; display: flex; flex-direction: column; background: #100b20; }
.empty-editor { display: flex; align-items: center; justify-content: center; padding: 20px; }
.empty-editor-state { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); text-align: center; }
.empty-editor-state > span { display: grid; place-items: center; width: 52px; height: 52px; color: var(--primary); background: var(--primary-2); border: 1px solid rgba(184, 146, 255, 0.3); border-radius: 8px; }
.empty-editor-state strong { color: var(--text-subtle); font-size: 13px; font-weight: 600; }
.empty-editor-state p { margin: 0; font-size: 11px; }

.editor-head { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; min-height: 76px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: rgba(18, 13, 34, 0.7); }
.editor-identity { display: flex; align-items: center; gap: 10px; min-width: 156px; }
.editor-type-icon { display: grid; place-items: center; flex: 0 0 36px; width: 36px; height: 36px; color: var(--primary); background: var(--primary-2); border: 1px solid rgba(184, 146, 255, 0.34); border-radius: 8px; }
.editor-type-icon.variable { color: var(--ok); background: rgba(110, 231, 183, 0.08); border-color: rgba(110, 231, 183, 0.28); }
.editor-identity strong { color: var(--text-subtle); font-family: var(--font-display); font-size: 12px; font-weight: 600; white-space: nowrap; }
.editor-meta-fields { display: flex; align-items: flex-end; gap: 10px; }
.inline { display: flex; flex-direction: column; gap: 4px; font-size: 10px; font-weight: 600; color: var(--muted); }
.name-input { width: 180px; }
.struct-id-input { width: 120px; }
.bound-tag { max-width: 150px; }
.need-hint { display: flex; align-items: center; gap: 5px; color: var(--danger); font-size: 10px; font-weight: 600; }

.view-tabs { display: flex; align-items: center; gap: 4px; min-height: 44px; padding: 6px 14px; border-bottom: 1px solid var(--border); background: rgba(18, 13, 34, 0.42); }
.view-tab { display: flex; align-items: center; gap: 7px; min-height: 30px; padding: 5px 10px; color: var(--muted); background: transparent; border-color: transparent; border-radius: 6px; font-size: 11px; font-weight: 600; }
.view-tab:hover { color: var(--text-subtle); background: var(--panel-2); }
.view-tab.active { color: var(--text); background: var(--primary-2); border-color: rgba(184, 146, 255, 0.36); }
.tab-count { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; color: var(--text-subtle); background: rgba(8, 5, 16, 0.34); border-radius: 5px; font-family: var(--font-display); font-size: 9px; }

.frame-scroll {
  flex: 1; min-height: 0; overflow: auto; padding: 14px 16px 18px;
  background: linear-gradient(180deg, rgba(35, 26, 59, 0.34), rgba(18, 13, 34, 0.42) 180px);
}

.json-bar { border-top: 1px solid var(--border); padding: 7px 14px; background: rgba(18, 13, 34, 0.94); }
.json-toggle { color: var(--text-subtle); }
.json-card { margin-top: 7px; padding: 10px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; }

@media (max-width: 1180px) {
  .editor-head { gap: 10px; }
  .editor-identity { flex: 1 1 100%; margin-right: 0; }
  .editor-meta-fields { flex: 1 1 auto; }
}

@media (max-width: 760px) {
  .editor-head { align-items: flex-start; min-height: 0; padding: 10px 12px; }
  .editor-identity { flex-basis: 100%; }
  .editor-meta-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(118px, 0.7fr); width: 100%; }
  .name-input, .struct-id-input { width: 100%; }
  .need-hint { width: 100%; }
  .view-tabs { overflow-x: auto; padding-inline: 10px; }
  .view-tab { flex: 0 0 auto; }
  .frame-scroll { padding: 10px 12px 16px; }
  .json-bar { padding-inline: 10px; }
}
</style>
