<script setup>
import { computed } from 'vue'
import {
  isListType,
  isComplexType,
  isVector3Type,
  isBoolType,
  getTypeMeta
} from '../lib/miliastra.js'

const props = defineProps({
  paramType: { type: String, required: true },
  modelValue: { required: true }
})
const emit = defineEmits(['update:modelValue'])

const meta = computed(() => getTypeMeta(props.paramType))
const isList = computed(() => isListType(props.paramType))
const isComplex = computed(() => isComplexType(props.paramType))
const isBool = computed(() => isBoolType(props.paramType))
const isVector3 = computed(() => isVector3Type(props.paramType))
const isNumber = computed(() =>
  ['Int32', 'Float', 'Guid', 'ConfigReference', 'EntityReference', 'Army', 'Entity'].includes(
    props.paramType
  )
)

function setScalar(v) {
  emit('update:modelValue', v)
}

// --- Vector3：内部以 "x,y,z" 字符串存储，编辑时拆成三个输入 ---
const vec = computed(() => {
  const parts = String(props.modelValue ?? '0,0,0').split(',')
  return [parts[0] ?? '0', parts[1] ?? '0', parts[2] ?? '0']
})
function setVec(i, v) {
  const arr = [...vec.value]
  arr[i] = v
  emit('update:modelValue', arr.join(','))
}

// --- 列表：普通标量列表 ---
function addListItem() {
  const list = Array.isArray(props.modelValue) ? [...props.modelValue] : []
  list.push(props.paramType === 'Vector3List' ? '0,0,0' : '')
  emit('update:modelValue', list)
}
function updateListItem(i, v) {
  const list = [...props.modelValue]
  list[i] = v
  emit('update:modelValue', list)
}
function removeListItem(i) {
  const list = [...props.modelValue]
  list.splice(i, 1)
  emit('update:modelValue', list)
}

// --- 复合类型（Struct / StructList / Dict）：JSON 文本编辑 ---
const complexText = computed(() => {
  try {
    return JSON.stringify(props.modelValue, null, 2)
  } catch {
    return ''
  }
})
function onComplexInput(text) {
  try {
    emit('update:modelValue', JSON.parse(text))
  } catch {
    // 解析失败时不更新，避免破坏数据
  }
}
</script>

<template>
  <!-- 布尔：True / False 下拉，保持千星字符串格式 -->
  <select v-if="isBool" :value="modelValue" @change="setScalar($event.target.value)">
    <option value="True">True</option>
    <option value="False">False</option>
  </select>

  <!-- 三维向量：X / Y / Z -->
  <div v-else-if="isVector3" style="display:flex; gap:6px; align-items:center;">
    <span class="hint">X</span>
    <input type="text" :value="vec[0]" @input="setVec(0, $event.target.value)" style="width:70px" />
    <span class="hint">Y</span>
    <input type="text" :value="vec[1]" @input="setVec(1, $event.target.value)" style="width:70px" />
    <span class="hint">Z</span>
    <input type="text" :value="vec[2]" @input="setVec(2, $event.target.value)" style="width:70px" />
  </div>

  <!-- 复合类型：Struct / StructList / Dict 以 JSON 文本编辑 -->
  <div v-else-if="isComplex" class="list-editor">
    <textarea
      style="min-height:120px"
      :value="complexText"
      @input="onComplexInput($event.target.value)"
    ></textarea>
    <span class="hint">{{ meta.title }}：以 JSON 编辑（值需为合法 JSON）</span>
  </div>

  <!-- 列表：StringList / Int32List / Vector3List 等标量列表 -->
  <div v-else-if="isList" class="list-editor">
    <div v-for="(item, i) in modelValue" :key="i" class="list-row">
      <input type="text" :value="item" @input="updateListItem(i, $event.target.value)" />
      <button class="ghost icon-btn danger" @click="removeListItem(i)">✕</button>
    </div>
    <button class="ghost icon-btn" @click="addListItem">+ 添加项</button>
    <span v-if="!modelValue || modelValue.length === 0" class="hint">空列表</span>
  </div>

  <!-- 数值标量 -->
  <input
    v-else-if="isNumber"
    type="text"
    :value="modelValue"
    @input="setScalar($event.target.value)"
    placeholder="0"
  />

  <!-- 其它标量（String 等） -->
  <input v-else type="text" :value="modelValue" @input="setScalar($event.target.value)" />
</template>
