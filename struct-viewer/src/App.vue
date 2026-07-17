<script setup>
import { onMounted } from 'vue'
import { useWorkspaceStore } from './stores/workspace.js'
import DefinitionsPanel from './components/DefinitionsPanel.vue'
import VariablesPanel from './components/VariablesPanel.vue'
import FieldEditor from './components/FieldEditor.vue'

const store = useWorkspaceStore()

onMounted(() => store.init())

function renameActive(e) {
  if (store.activeWorkspace) store.renameWorkspace(store.activeWorkspace.id, e.target.value)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>千星奇域 · 结构体编辑器</h1>

      <div class="ws-bar">
        <span class="ws-label">工作区（存档）</span>
        <div class="ws-tabs">
          <button
            v-for="w in store.workspaces"
            :key="w.id"
            class="ws-tab"
            :class="{ active: w.id === store.activeWorkspaceId }"
            @click="store.selectWorkspace(w.id)"
          >
            {{ w.name }}
            <span
              v-if="store.workspaces.length > 1"
              class="ws-close"
              title="删除存档"
              @click.stop="store.removeWorkspace(w.id)"
            >✕</span>
          </button>
          <button class="ws-add" title="新建存档" @click="store.addWorkspace()">+</button>
        </div>
      </div>

      <span class="spacer"></span>
      <span v-if="store.message" class="message">{{ store.message }}</span>
    </header>

    <div class="workspace-meta" v-if="store.activeWorkspace">
      <label>
        当前存档名
        <input type="text" :value="store.activeWorkspace.name" @input="renameActive" />
      </label>
      <span class="hint">不同存档相互独立，structId 可以重复。</span>
    </div>

    <main class="main-3col">
      <DefinitionsPanel class="col-defs" />
      <VariablesPanel class="col-vars" />
      <FieldEditor class="col-editor" />
    </main>
  </div>
</template>

<style scoped>
.app-shell { display: flex; flex-direction: column; height: 100vh; }
.app-header {
  display: flex; align-items: center; gap: 16px; padding: 0 20px; height: 56px;
  border-bottom: 1px solid var(--border); background: var(--panel);
}
.app-header h1 { font-size: 16px; margin: 0; white-space: nowrap; }
.ws-bar { display: flex; align-items: center; gap: 10px; }
.ws-label { font-size: 12px; color: var(--muted); }
.ws-tabs { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ws-tab {
  border-radius: 16px; padding: 4px 12px; display: flex; align-items: center; gap: 6px;
}
.ws-tab.active { background: var(--primary-2); border-color: var(--primary); }
.ws-close { opacity: 0.6; font-size: 11px; }
.ws-close:hover { opacity: 1; color: var(--danger); }
.ws-add { border-radius: 16px; padding: 4px 10px; }
.message { color: var(--ok); font-size: 13px; }

.workspace-meta {
  display: flex; align-items: center; gap: 12px; padding: 8px 20px;
  border-bottom: 1px solid var(--border); background: var(--panel);
}
.workspace-meta label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.workspace-meta input { min-width: 200px; }

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
