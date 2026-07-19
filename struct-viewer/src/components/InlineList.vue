<script setup>
import { computed } from 'vue'
import { defaultValueForType } from '../lib/miliastra.js'
import ScalarValue from './ScalarValue.vue'

const props = defineProps({
  itemType: { type: String, required: true },
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const items = computed(() => props.modelValue ?? [])

function blank() {
  return JSON.parse(JSON.stringify(defaultValueForType(props.itemType)))
}
function setItem(i, v) {
  const a = [...items.value]
  a[i] = v
  emit('update:modelValue', a)
}
function removeAt(i) {
  const a = [...items.value]
  a.splice(i, 1)
  emit('update:modelValue', a)
}
function insertAt(i) {
  const a = [...items.value]
  a.splice(i, 0, blank())
  emit('update:modelValue', a)
}
function append() {
  emit('update:modelValue', [...items.value, blank()])
}
</script>

<template>
  <div class="inline-list" :title="`列表（${itemType}）`">
    <div v-for="(item, i) in items" :key="i" class="li-row">
      <span class="idx">{{ i }}</span>
      <ScalarValue :param-type="itemType" :model-value="items[i]" @update:model-value="setItem(i, $event)" />
      <button class="ins" title="在此前插入一项" @click="insertAt(i)">+</button>
      <button class="rm" title="删除此项" @click="removeAt(i)">×</button>
    </div>
    <button class="add" title="添加一项" @click="append">+ 添加项</button>
  </div>
</template>

<style scoped>
.inline-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 3px 4px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: rgba(108, 140, 255, 0.06);
  min-width: 120px;
}
.li-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.idx { color: var(--muted); font-size: 11px; min-width: 12px; text-align: right; }
.li-row :deep(input),
.li-row :deep(select) {
  width: 100%;
  padding: 2px 4px;
}
.rm, .ins {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  font-size: 13px;
}
.rm { color: var(--muted); }
.rm:hover { color: var(--danger); }
.ins { color: var(--primary); font-weight: 700; }
.ins:hover { background: var(--panel-2); border-radius: 4px; }
.add {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-size: 12px;
  padding: 1px 4px;
}
.add:hover { background: var(--panel-2); border-radius: 4px; }
</style>
