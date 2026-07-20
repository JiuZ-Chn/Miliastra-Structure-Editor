<script setup>
import { onMounted } from 'vue'
import { Plus, X } from '@lucide/vue'
import { NConfigProvider, NButton, NInput, darkTheme } from 'naive-ui'
import { appThemeOverrides } from './theme.js'
import { useWorkspaceStore } from './stores/workspace.js'
import DefinitionsPanel from './components/DefinitionsPanel.vue'
import VariablesPanel from './components/VariablesPanel.vue'
import FieldEditor from './components/FieldEditor.vue'

const store = useWorkspaceStore()

onMounted(() => store.init())

function renameActive(val) {
  if (store.activeWorkspace) store.renameWorkspace(store.activeWorkspace.id, val)
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="appThemeOverrides">
    <div class="app-shell">
      <header class="app-header">
        <h1>千星奇域 · 结构体编辑器</h1>

        <div class="ws-bar">
          <span class="ws-label">工作区（存档）</span>
          <div class="ws-tabs">
            <n-button
              v-for="w in store.workspaces"
              :key="w.id"
              size="small"
              round
              :type="w.id === store.activeWorkspaceId ? 'primary' : 'default'"
              :secondary="w.id !== store.activeWorkspaceId"
              @click="store.selectWorkspace(w.id)"
            >
              {{ w.name }}
              <span
                v-if="store.workspaces.length > 1"
                class="ws-close"
                title="删除存档"
                @click.stop="store.removeWorkspace(w.id)"
              ><X :size="12" /></span>
            </n-button>
            <n-button size="small" circle secondary title="新建存档" @click="store.addWorkspace()">
              <template #icon><Plus :size="15" /></template>
            </n-button>
          </div>
        </div>

        <span class="spacer"></span>
        <span v-if="store.message" class="message">{{ store.message }}</span>
      </header>

      <div class="workspace-meta" v-if="store.activeWorkspace">
        <label>
          <span>当前存档名</span>
          <n-input
            size="small"
            :value="store.activeWorkspace.name"
            style="min-width: 200px"
            @update:value="renameActive"
          />
        </label>
        <span class="hint">不同存档相互独立，结构体索引可以重复。</span>
      </div>

      <main class="main-3col">
        <DefinitionsPanel class="col-defs" />
        <VariablesPanel class="col-vars" />
        <FieldEditor class="col-editor" />
      </main>
    </div>
  </n-config-provider>
</template>

<style scoped>
.app-shell { display: flex; flex-direction: column; height: 100vh; }
.app-header {
  display: flex; align-items: center; gap: 16px; padding: 0 22px; height: 58px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(28, 28, 36, 0.65), rgba(16, 16, 22, 0.55));
  backdrop-filter: blur(8px);
  position: relative;
}
.app-header::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(124, 108, 255, 0.6), transparent);
}
.app-header h1 {
  font-size: 16px; margin: 0; white-space: nowrap; font-weight: 600;
  letter-spacing: 0.01em;
  background: linear-gradient(180deg, #ffffff, #b9b2ff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.ws-bar { display: flex; align-items: center; gap: 10px; }
.ws-label { font-size: 12px; color: var(--muted); }
.ws-tabs { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ws-close { opacity: 0.55; font-size: 11px; margin-left: 2px; }
.ws-close:hover { opacity: 1; color: var(--danger); }
.message { color: var(--ok); font-size: 13px; }

.workspace-meta {
  display: flex; align-items: center; gap: 12px; padding: 8px 22px;
  border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.015);
}
.workspace-meta label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }

.main-3col {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 260px 1fr;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}
.col-defs, .col-vars { overflow: hidden; min-height: 0; }
.col-editor { overflow: hidden; min-height: 0; }
</style>
