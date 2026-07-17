<script setup>
import { ref, computed, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { PARAM_TYPES, PARAM_TYPE_META, toJSON } from '../lib/miliastra.js'
import ParamValueEditor from './ParamValueEditor.vue'

const store = useWorkspaceStore()

const target = computed(() => store.editingTarget)
const isDefinition = computed(() => store.editing === 'definition')
const isVariable = computed(() => store.editing === 'variable')

/** 结构体 structId 仅允许数字（游戏中为索引） */
function onStructIdInput(e) {
  const digits = e.target.value.replace(/\D/g, '')
  e.target.value = digits
  if (target.value) {
    target.value.structId = digits
    store.touch()
  }
}

const jsonPreview = computed(() => {
  if (!target.value) return ''
  const obj = isDefinition.value
    ? store.exportDefinition(target.value.id)
    : store.exportVariable(target.value.id)
  return obj ? toJSON(obj) : ''
})

// 可编辑 JSON（应用后反向转换回结构）
const jsonEdit = ref('')
const jsonDirty = ref(false)
const jsonError = ref('')
watch(
  jsonPreview,
  (v) => {
    if (!jsonDirty.value) jsonEdit.value = v
  },
  { immediate: true }
)
function onJsonInput(v) {
  jsonEdit.value = v
  jsonDirty.value = true
}
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
function resetJson() {
  jsonEdit.value = jsonPreview.value
  jsonDirty.value = false
  jsonError.value = ''
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonEdit.value)
    store.message = '已复制到剪贴板'
  } catch {
    store.message = '复制失败，请手动复制'
  }
}
</script>

<template>
  <div v-if="target" class="editor">
    <div class="editor-scroll">
    <div class="editor-head">
      <span class="chip" :class="isDefinition ? 'chip-def' : 'chip-var'">
        {{ isDefinition ? '结构体定义' : '结构体变量' }}
      </span>
      <label class="inline">
        名称
        <input type="text" v-model="target.name" @input="store.touch()" />
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
        />
        <span v-else class="chip" title="变量的 structId 绑定结构体定义，不可修改">
          {{ target.structId }}（绑定定义，不可改）
        </span>
      </label>
      <label v-if="isDefinition" class="inline">
        struct_ype
        <input type="text" v-model="target.structType" @input="store.touch()" />
      </label>
    </div>

    <div class="toolbar">
      <button v-if="isDefinition" class="primary" @click="store.addField()">+ 添加字段</button>
      <span class="hint">
        {{ isVariable ? '变量仅编辑值，字段名/类型来自定义' : '共 ' + target.fields.length + ' 个字段' }}
      </span>
    </div>

    <table class="field-table">
      <thead>
        <tr>
          <th style="width: 36px">#</th>
          <th style="width: 22%">字段名 (key)</th>
          <th style="width: 22%">类型 (param_type)</th>
          <th>值 (value)</th>
          <th v-if="isDefinition" style="width: 120px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(field, i) in target.fields" :key="i">
          <td>{{ i }}</td>
          <td>
            <input v-if="isDefinition" type="text" v-model="field.key" @input="store.touch()" />
            <span v-else class="chip">{{ field.key }}</span>
          </td>
          <td>
            <select
              v-if="isDefinition"
              :value="field.paramType"
              @change="store.changeFieldType(i, $event.target.value)"
            >
              <option v-for="t in PARAM_TYPES" :key="t" :value="t">
                {{ PARAM_TYPE_META[t].title }}（{{ t }}）
              </option>
            </select>
            <span v-else>{{ PARAM_TYPE_META[field.paramType]?.title }}（{{ field.paramType }}）</span>
          </td>
          <td>
            <ParamValueEditor
              :param-type="field.paramType"
              v-model="field.value"
              @update:modelValue="store.touch()"
            />
          </td>
          <td v-if="isDefinition">
            <button class="ghost icon-btn" @click="store.moveField(i, -1)" :disabled="i === 0">↑</button>
            <button
              class="ghost icon-btn"
              @click="store.moveField(i, 1)"
              :disabled="i === target.fields.length - 1"
            >↓</button>
            <button class="ghost icon-btn danger" @click="store.removeField(i)">✕</button>
          </td>
        </tr>
        <tr v-if="target.fields.length === 0">
          <td :colspan="isDefinition ? 5 : 4" class="hint">暂无字段。</td>
        </tr>
      </tbody>
    </table>

    <div class="json-card">
      <h3>
        {{ isDefinition ? '结构体（定义）JSON' : '结构体变量 JSON' }}
        <span v-if="jsonDirty" class="chip" style="color:var(--danger)">未应用</span>
      </h3>
      <textarea :value="jsonEdit" @input="onJsonInput($event.target.value)"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="primary" @click="applyJson" :disabled="!jsonDirty">应用修改</button>
        <button @click="resetJson" :disabled="!jsonDirty">还原</button>
        <button @click="copyJson">复制</button>
      </div>
      <div v-if="jsonError" class="error">{{ jsonError }}</div>
      <p class="hint">直接编辑此普通 JSON 后点击“应用修改”，会反向转换回千星结构并原地更新当前{{ isDefinition ? '定义' : '变量' }}。</p>
    </div>
    </div>
  </div>

  <div v-else class="editor empty-editor">
    <p class="hint">
      从「高级数据管理」选择一个结构体定义，或从「自定义变量」选择一个变量开始编辑。
    </p>
  </div>
</template>

<style scoped>
.editor { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.editor-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.empty-editor { display: flex; align-items: center; justify-content: center; padding: 16px; }
.editor-head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.inline { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.chip-def { background: #2b2f6a; color: #c9d2ff; }
.chip-var { background: #14532d; color: #b6f0cf; }
.json-card { margin-top: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.json-card h3 { margin-top: 0; font-size: 14px; }
</style>
