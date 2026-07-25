<script setup>
import { onMounted, ref, watch } from 'vue'
import { Braces, Code2, Plus, Table2, X } from '@lucide/vue'
import { NConfigProvider, NButton, NInput, darkTheme } from 'naive-ui'
import { appThemeOverrides } from './theme.js'
import { useWorkspaceStore } from './stores/workspace.js'
import DefinitionsPanel from './components/DefinitionsPanel.vue'
import VariablesPanel from './components/VariablesPanel.vue'
import FieldEditor from './components/FieldEditor.vue'

const store = useWorkspaceStore()
const activePane = ref('definitions')

onMounted(() => store.init())

watch(
  () => [store.editing, store.activeDefId, store.activeVariableId],
  ([editing]) => {
    if (editing) activePane.value = 'editor'
  }
)

watch(() => store.activeWorkspaceId, () => {
  activePane.value = 'definitions'
})

function renameActive(val) {
  if (store.activeWorkspace) store.renameWorkspace(store.activeWorkspace.id, val)
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="appThemeOverrides">
    <div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"><Braces :size="18" /></span>
          <div class="brand-copy">
            <h1>Miliastra</h1>
            <span>Structure Editor</span>
          </div>
        </div>

        <div class="ws-bar">
          <span class="ws-label">工作区</span>
          <div class="ws-tabs">
            <n-button
              v-for="w in store.workspaces"
              :key="w.id"
              class="workspace-tab"
              size="small"
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
        <span v-if="store.message" class="status-message">
          <span class="status-dot" aria-hidden="true"></span>
          {{ store.message }}
        </span>
      </header>

      <div class="workspace-meta" v-if="store.activeWorkspace">
        <label class="workspace-name-field">
          <span>当前存档名</span>
          <n-input
            class="workspace-name-input"
            size="small"
            :value="store.activeWorkspace.name"
            @update:value="renameActive"
          />
        </label>
        <span class="workspace-divider" aria-hidden="true"></span>
        <div class="workspace-stats" aria-label="当前存档统计">
          <span><strong>{{ store.definitions.length }}</strong> 定义</span>
          <span><strong>{{ store.variables.length }}</strong> 变量</span>
        </div>
        <span class="hint">不同存档相互独立，结构体索引可以重复。</span>
      </div>

      <nav class="mobile-pane-nav" aria-label="编辑区域">
        <button
          type="button"
          :class="{ active: activePane === 'definitions' }"
          :aria-pressed="activePane === 'definitions'"
          @click="activePane = 'definitions'"
        >
          <Braces :size="15" />
          定义
          <span>{{ store.definitions.length }}</span>
        </button>
        <button
          type="button"
          :class="{ active: activePane === 'variables' }"
          :aria-pressed="activePane === 'variables'"
          @click="activePane = 'variables'"
        >
          <Table2 :size="15" />
          变量
          <span>{{ store.variables.length }}</span>
        </button>
        <button
          type="button"
          :class="{ active: activePane === 'editor' }"
          :aria-pressed="activePane === 'editor'"
          @click="activePane = 'editor'"
        >
          <Code2 :size="15" />
          编辑
        </button>
      </nav>

      <main class="main-3col">
        <DefinitionsPanel
          class="col-defs workspace-pane"
          :class="{ 'pane-active': activePane === 'definitions' }"
        />
        <VariablesPanel
          class="col-vars workspace-pane"
          :class="{ 'pane-active': activePane === 'variables' }"
        />
        <FieldEditor
          class="col-editor workspace-pane"
          :class="{ 'pane-active': activePane === 'editor' }"
        />
      </main>
    </div>
  </n-config-provider>
</template>

<style scoped>
.app-shell { display: flex; flex-direction: column; height: 100dvh; min-width: 0; }
.app-header {
  display: flex; align-items: center; gap: 18px; padding: 0 18px; min-height: 64px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(27, 20, 49, 0.96), rgba(18, 13, 34, 0.92));
  backdrop-filter: blur(14px);
  position: relative;
}
.app-header::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(184, 146, 255, 0.72), rgba(255, 121, 207, 0.42), transparent);
}
.brand { display: flex; align-items: center; gap: 10px; flex: 0 0 218px; min-width: 0; }
.brand-mark {
  display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px;
  color: var(--primary); background: rgba(184, 146, 255, 0.1);
  border: 1px solid rgba(184, 146, 255, 0.38); border-radius: 8px;
  box-shadow: 0 0 20px rgba(184, 146, 255, 0.12);
}
.brand-copy { min-width: 0; line-height: 1; }
.brand-copy h1 {
  font-family: var(--font-display); font-size: 15px; margin: 0 0 5px; white-space: nowrap;
  font-weight: 700; color: var(--text); letter-spacing: 0;
}
.brand-copy span {
  display: block; color: var(--muted); font-family: var(--font-display);
  font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
}
.ws-bar { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ws-label { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--muted); }
.ws-tabs { display: flex; gap: 6px; align-items: center; min-width: 0; overflow-x: auto; padding: 3px 0; }
.workspace-tab { flex: 0 0 auto; max-width: 170px; }
.ws-close { opacity: 0.55; font-size: 11px; margin-left: 2px; }
.ws-close:hover { opacity: 1; color: var(--danger); }
.status-message {
  display: flex; align-items: center; gap: 7px; max-width: 320px;
  color: var(--text-subtle); font-size: 12px; line-height: 1.35;
}
.status-dot { flex: 0 0 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 10px rgba(110, 231, 183, 0.6); }

.workspace-meta {
  display: flex; align-items: center; gap: 14px; min-height: 46px; padding: 7px 18px;
  border-bottom: 1px solid var(--border); background: rgba(27, 20, 49, 0.56);
}
.workspace-name-field { display: flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 600; color: var(--muted); }
.workspace-name-input { width: 190px; }
.workspace-divider { width: 1px; height: 20px; background: var(--border); }
.workspace-stats { display: flex; gap: 12px; color: var(--muted); font-size: 11px; }
.workspace-stats strong { color: var(--text-subtle); font-family: var(--font-display); font-size: 12px; }
.workspace-meta > .hint { margin-left: auto; }

.mobile-pane-nav { display: none; }

.main-3col {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 236px 236px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}
.col-defs, .col-vars { overflow: hidden; min-height: 0; }
.col-editor { overflow: hidden; min-height: 0; }

@media (max-width: 1100px) {
  .brand { flex-basis: 198px; }
  .main-3col { grid-template-columns: 218px 218px minmax(0, 1fr); }
  .status-message { max-width: 220px; }
  .workspace-meta > .hint { display: none; }
}

@media (max-width: 760px) {
  .app-header { gap: 10px; min-height: 56px; padding: 0 12px; }
  .brand { flex-basis: auto; }
  .brand-mark { width: 32px; height: 32px; flex-basis: 32px; }
  .brand-copy span { display: none; }
  .brand-copy h1 { margin: 0; }
  .ws-label, .status-message { display: none; }
  .ws-bar { flex: 1; }
  .ws-tabs { width: 100%; }
  .workspace-tab { max-width: 132px; }

  .workspace-meta { min-height: 44px; padding: 6px 12px; }
  .workspace-name-field > span, .workspace-divider { display: none; }
  .workspace-name-input { width: min(48vw, 190px); }
  .workspace-stats { margin-left: auto; }

  .mobile-pane-nav {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
    padding: 6px 8px; border-bottom: 1px solid var(--border); background: var(--panel-solid);
  }
  .mobile-pane-nav button {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    min-width: 0; min-height: 32px; padding: 5px 8px; border-radius: 6px;
    background: transparent; border-color: transparent; color: var(--muted); font-size: 12px;
  }
  .mobile-pane-nav button:hover { background: var(--panel-2); }
  .mobile-pane-nav button.active { color: var(--text); background: var(--primary-2); border-color: rgba(184, 146, 255, 0.38); }
  .mobile-pane-nav button > span { color: var(--muted); font-family: var(--font-display); font-size: 10px; }

  .main-3col { display: block; overflow: hidden; }
  .workspace-pane { display: none !important; }
  .workspace-pane.pane-active { display: flex !important; width: 100%; height: 100%; }
}

@media (max-width: 430px) {
  .brand { flex-shrink: 1; }
  .brand-copy h1 { font-size: 13px; }
  .brand-mark { margin-right: 2px; }
  .workspace-tab { max-width: 96px; }
  .workspace-stats { gap: 8px; }
  .workspace-stats span { font-size: 0; }
  .workspace-stats strong { font-size: 11px; }
  .workspace-stats span:first-child::after { content: " 定义"; font-size: 10px; }
  .workspace-stats span:last-child::after { content: " 变量"; font-size: 10px; }
}
</style>
