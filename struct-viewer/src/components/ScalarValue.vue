<script setup>
import { computed } from 'vue'
import { isBoolType, isVector3Type } from '../lib/miliastra.js'

const props = defineProps({
  paramType: { type: String, required: true },
  modelValue: { required: true }
})
const emit = defineEmits(['update:modelValue'])

const isBool = computed(() => isBoolType(props.paramType))
const isVector3 = computed(() => isVector3Type(props.paramType))

const vec = computed(() => {
  const p = String(props.modelValue ?? '0,0,0').split(',')
  return [p[0] ?? '0', p[1] ?? '0', p[2] ?? '0']
})
function setVec(i, v) {
  const arr = [...vec.value]
  arr[i] = v
  emit('update:modelValue', arr.join(','))
}
</script>

<template>
  <select v-if="isBool" :value="modelValue" @change="emit('update:modelValue', $event.target.value)">
    <option value="True">True</option>
    <option value="False">False</option>
  </select>

  <div v-else-if="isVector3" class="vec3">
    <input :value="vec[0]" @input="setVec(0, $event.target.value)" placeholder="X" />
    <input :value="vec[1]" @input="setVec(1, $event.target.value)" placeholder="Y" />
    <input :value="vec[2]" @input="setVec(2, $event.target.value)" placeholder="Z" />
  </div>

  <input v-else type="text" :value="modelValue" @input="emit('update:modelValue', $event.target.value)" />
</template>

<style scoped>
.vec3 { display: flex; gap: 4px; }
.vec3 input { width: 64px; }
input, select { width: 100%; }
</style>
