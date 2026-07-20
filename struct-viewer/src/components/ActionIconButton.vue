<script setup>
import { NButton, NIcon, NTooltip } from 'naive-ui'

defineProps({
  label: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  disabled: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
  primary: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})

defineEmits(['click'])
</script>

<template>
  <n-tooltip trigger="hover" :delay="250">
    <template #trigger>
      <n-button
        class="action-icon-button"
        :class="{ compact }"
        size="small"
        circle
        quaternary
        :disabled="disabled"
        :type="danger ? 'error' : primary ? 'primary' : 'default'"
        :aria-label="label"
        @click="$emit('click', $event)"
      >
        <template #icon>
          <n-icon :size="15">
            <component :is="icon" />
          </n-icon>
        </template>
      </n-button>
    </template>
    {{ label }}
  </n-tooltip>
</template>

<style scoped>
.action-icon-button {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
}
.action-icon-button:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.06);
}
.action-icon-button.compact {
  flex-basis: 24px;
  width: 24px;
  height: 24px;
}
</style>