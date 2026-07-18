<script setup>
import { ref, computed, watch, provide } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { toJSON } from '../lib/miliastra.js'
import FrameView from './FrameView.vue'

const store = useWorkspaceStore()

const target = computed(() => store.editingTarget)
const isDefinition = computed(() => store.editing === 'definition')
const isVariable = computed(() => store.editing === 'variable')

// ---- 面包屑导航栈：nav[0] 是根（定义/变量本身）----
const nav = ref([])

function rootFrame() {
  const t = target.value
  if (!t) return null
  return {
    kind: 'struct',
    label: t.name,
    rootFields: t.fields,
    isRoot: true
  }
}

// 当切换编辑对象时，重置导航到根
watch(
  () => [store.editing, target.value?.id],
  () => {
    const rf = rootFrame()
    nav.value = rf ? [rf] : []
  },
  { immediate: true }
)

const currentFrame = computed(() => nav.value[nav.value.length - 1] || null)

function navigate(frame) {
  nav.value.push(frame)
}
function goTo(index) {
  nav.value = nav.value.slice(0, index + 1)
}
provide('navigate', navigate)

// ---- structId 数字限制 ----
function onStructIdInput(e) {
  const digits = e.target.value.replace(/\D/g, '')
  e.target.value = digits
  if (target.value) target.value.structId = digits
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
    const rf = rootFrame()
    nav.value = rf ? [rf] : []
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
      <span class="chip" :class="isDefinition ? 'chip-def' : 'chip-var'">
        {{ isDefinition ? '结构体定义' : '结构体变量' }}
      </span>
      <label class="inline">
        名称
        <input type="text" v-model="target.name" />
      </label>
      <label class="inline">
        structId
        <input
          v-if="isDefinition"
          type="text"
          inputmode="numeric"
          :value="target.structId"
          @input="onStructIdInput"
          placeholder="仅数字"
          :class="{ 'need-input': isDefinition && !target.structId }"
        />
        <span v-else class="chip" title="变量的 structId 绑定结构体定义，不可修改">
          {{ target.structId }}（绑定定义）
        </span>
      </label>
      <span v-if="isDefinition && !target.structId" class="need-hint">⚠ 请为该结构体填写 structId（数字）</span>
    </div>

    <!-- 面包屑 -->
    <nav class="crumbs">
      <template v-for="(f, i) in nav" :key="i">
        <button class="crumb" :class="{ active: i === nav.length - 1 }" @click="goTo(i)">
          {{ i === 0 ? (target.name || '根') : f.label }}
        </button>
        <span v-if="i < nav.length - 1" class="crumb-sep">›</span>
      </template>
    </nav>

    <div class="frame-scroll">
      <FrameView
        v-if="currentFrame"
        :frame="currentFrame"
        :editable-schema="isDefinition && currentFrame.isRoot === true"
      />
    </div>

    <!-- 底部整体 JSON -->
    <div class="json-bar">
      <button class="ghost" @click="jsonOpen = !jsonOpen">
        {{ jsonOpen ? '▾' : '▸' }} 整体 JSON（{{ isDefinition ? '结构体定义' : '结构体变量' }}）
        <span v-if="jsonDirty" class="chip" style="color:var(--danger)">未应用</span>
      </button>
      <div v-if="jsonOpen" class="json-card">
        <textarea :value="jsonEdit" @input="onJsonInput($event.target.value)"></textarea>
        <div class="toolbar" style="margin-top:8px">
          <button class="primary" @click="applyJson" :disabled="!jsonDirty">应用修改</button>
          <button @click="resetJson" :disabled="!jsonDirty">还原</button>
          <button @click="copyJson">复制</button>
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
.chip-def { background: #2b2f6a; color: #c9d2ff; }
.chip-var { background: #14532d; color: #b6f0cf; }
.need-input { border-color: var(--danger) !important; }
.need-hint { color: var(--danger); font-size: 12px; }

.crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 4px 16px 10px; border-bottom: 1px solid var(--border); }
.crumb { border: none; background: transparent; color: var(--muted); padding: 2px 8px; border-radius: 6px; }
.crumb:hover { background: var(--panel-2); color: var(--text); }
.crumb.active { color: var(--text); background: var(--panel-2); }
.crumb-sep { color: var(--muted); }

.frame-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px; }

.json-bar { border-top: 1px solid var(--border); padding: 8px 16px; background: var(--panel); }
.json-card { margin-top: 8px; }
</style>
