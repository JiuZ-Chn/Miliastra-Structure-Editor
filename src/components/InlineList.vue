<script setup>
import { computed } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { NButton } from 'naive-ui'
import { defaultValueForType } from '../lib/miliastra.js'
import ScalarValue from './ScalarValue.vue'
import ActionIconButton from './ActionIconButton.vue'

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
      <ActionIconButton label="在此前插入一项" :icon="Plus" compact primary @click="insertAt(i)" />
      <ActionIconButton label="删除此项" :icon="Trash2" compact danger @click="removeAt(i)" />
    </div>
    <n-button class="add" text type="primary" size="tiny" @click="append">
      <template #icon><Plus :size="13" /></template>
      添加项
    </n-button>
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
  background: var(--panel-2);
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
.add { align-self: flex-start; }
</style>
