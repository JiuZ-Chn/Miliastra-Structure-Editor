import { defineStore } from 'pinia'
import {
  parseStructDefinition,
  parseStructVariable,
  buildStructDefinition,
  buildStructVariable,
  defaultValueForType,
  fromJSON
} from '../lib/miliastra.js'
import simpleStruct from '../samples/simple-struct.json'
import complexStruct from '../samples/complex-struct.json'

/** 内置示例（结构体定义，打包进 Vue 应用） */
export const SAMPLES = [
  { key: 'simple', label: '简单结构体', data: simpleStruct },
  { key: 'complex', label: '复杂结构体（全类型）', data: complexStruct }
]

const STORAGE_KEY = 'miliastra-struct-viewer'

let uid = 1
const nextId = () => uid++

/** 生成一个游戏风格的 structId */
function genStructId() {
  return String(1077936129 + Math.floor(Math.random() * 100000))
}

function createWorkspace(name = '存档 1') {
  return { id: nextId(), name, definitions: [], variables: [] }
}

function cloneFields(fields) {
  return fields.map((f) => ({
    key: f.key,
    paramType: f.paramType,
    value: JSON.parse(JSON.stringify(f.value))
  }))
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    /** 工作区（游戏存档）列表，彼此独立 */
    workspaces: [],
    activeWorkspaceId: null,
    /** 当前选中的结构体定义 / 变量 */
    activeDefId: null,
    activeVariableId: null,
    /** 编辑器当前编辑的对象：definition | variable | null */
    editing: null,
    message: ''
  }),

  getters: {
    activeWorkspace(state) {
      return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || null
    },
    definitions() {
      return this.activeWorkspace?.definitions ?? []
    },
    variables() {
      return this.activeWorkspace?.variables ?? []
    },
    activeDefinition(state) {
      return this.definitions.find((d) => d.id === state.activeDefId) || null
    },
    activeVariable(state) {
      return this.variables.find((v) => v.id === state.activeVariableId) || null
    },
    /** 编辑器当前作用的对象 */
    editingTarget(state) {
      if (state.editing === 'definition') return this.activeDefinition
      if (state.editing === 'variable') return this.activeVariable
      return null
    }
  },

  actions: {
    // ---------- 初始化 / 持久化 ----------
    init() {
      this.load()
      if (this.workspaces.length === 0) {
        const w = createWorkspace('存档 1')
        this.workspaces.push(w)
        this.activeWorkspaceId = w.id
        this.loadSample('complex')
      }
    },

    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ workspaces: this.workspaces, uid }))
      } catch {
        /* 忽略持久化异常 */
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const data = JSON.parse(raw)
        this.workspaces = data.workspaces ?? []
        uid = data.uid ?? 1
        this.activeWorkspaceId = this.workspaces[0]?.id ?? null
      } catch {
        /* 忽略读取异常 */
      }
    },

    // ---------- 工作区（游戏存档） ----------
    addWorkspace() {
      const w = createWorkspace(`存档 ${this.workspaces.length + 1}`)
      this.workspaces.push(w)
      this.activeWorkspaceId = w.id
      this.activeDefId = null
      this.activeVariableId = null
      this.editing = null
      this.persist()
    },

    selectWorkspace(id) {
      this.activeWorkspaceId = id
      this.activeDefId = null
      this.activeVariableId = null
      this.editing = null
    },

    renameWorkspace(id, name) {
      const w = this.workspaces.find((x) => x.id === id)
      if (w) {
        w.name = name
        this.persist()
      }
    },

    removeWorkspace(id) {
      const idx = this.workspaces.findIndex((w) => w.id === id)
      if (idx < 0) return
      this.workspaces.splice(idx, 1)
      if (this.activeWorkspaceId === id) {
        this.activeWorkspaceId = this.workspaces[0]?.id ?? null
        this.activeDefId = null
        this.activeVariableId = null
        this.editing = null
      }
      this.persist()
    },

    // ---------- 高级数据管理：结构体定义 ----------
    addDefinition() {
      const w = this.activeWorkspace
      if (!w) return
      const def = {
        id: nextId(),
        structId: '',
        name: `结构体 ${w.definitions.length + 1}`,
        structType: 'basic',
        fields: []
      }
      w.definitions.push(def)
      this.selectDefinition(def.id)
      this.persist()
    },

    selectDefinition(id) {
      this.activeDefId = id
      this.editing = 'definition'
    },

    removeDefinition(id) {
      const w = this.activeWorkspace
      if (!w) return
      const idx = w.definitions.findIndex((d) => d.id === id)
      if (idx >= 0) w.definitions.splice(idx, 1)
      if (this.activeDefId === id) {
        this.activeDefId = null
        if (this.editing === 'definition') this.editing = null
      }
      this.persist()
    },

    /** 导入结构体定义 JSON 到当前工作区（structId 由用户导入后填写） */
    importDefinition(text) {
      const w = this.activeWorkspace
      if (!w) throw new Error('请先选择或新建一个工作区')
      const obj = fromJSON(text)
      const parsed = parseStructDefinition(obj)
      const def = {
        id: nextId(),
        structId: '',
        name: parsed.name,
        structType: parsed.structType,
        fields: parsed.fields
      }
      w.definitions.push(def)
      this.selectDefinition(def.id)
      this.message = `已导入「${parsed.name}」，请为它填写 structId`
      this.persist()
    },

    exportDefinition(id) {
      const def = this.definitions.find((d) => d.id === id) ?? this.activeDefinition
      if (!def) return null
      return buildStructDefinition({
        name: def.name,
        structType: def.structType,
        fields: def.fields
      })
    },

    // ---------- 自定义变量：结构体变量 ----------
    /** 基于某个结构体定义创建变量 */
    addVariable(defId) {
      const w = this.activeWorkspace
      if (!w) return
      const def = w.definitions.find((d) => d.id === defId)
      if (!def) {
        this.message = '请先在“高级数据管理”中创建结构体定义'
        return
      }
      const variable = {
        id: nextId(),
        name: `${def.name} 变量 ${w.variables.length + 1}`,
        structId: def.structId,
        defId: def.id,
        fields: cloneFields(def.fields)
      }
      w.variables.push(variable)
      this.selectVariable(variable.id)
      this.persist()
    },

    selectVariable(id) {
      this.activeVariableId = id
      this.editing = 'variable'
      const v = this.variables.find((x) => x.id === id)
      if (v) this.syncVariableKeys(v)
    },

    /** 从绑定的结构体定义同步变量字段的 key / 类型（变量不自己维护字段名） */
    syncVariableKeys(variable) {
      const w = this.activeWorkspace
      if (!w || !variable) return
      const def =
        w.definitions.find((d) => d.id === variable.defId) ??
        w.definitions.find((d) => d.structId === variable.structId)
      if (!def) return
      variable.defId = def.id
      variable.fields.forEach((f, i) => {
        const df = def.fields[i]
        if (df) {
          f.key = df.key
          f.paramType = df.paramType
        }
      })
    },

    removeVariable(id) {
      const w = this.activeWorkspace
      if (!w) return
      const idx = w.variables.findIndex((v) => v.id === id)
      if (idx >= 0) w.variables.splice(idx, 1)
      if (this.activeVariableId === id) {
        this.activeVariableId = null
        if (this.editing === 'variable') this.editing = null
      }
      this.persist()
    },

    /** 复制一个变量（用于变量表批量创建） */
    duplicateVariable(id) {
      const w = this.activeWorkspace
      if (!w) return
      const idx = w.variables.findIndex((v) => v.id === id)
      if (idx < 0) return
      const v = w.variables[idx]
      const copy = {
        id: nextId(),
        name: `${v.name} 副本`,
        structId: v.structId,
        defId: v.defId,
        fields: cloneFields(v.fields)
      }
      w.variables.splice(idx + 1, 0, copy)
      this.persist()
    },

    /** 用一批「名称 + 字段值」重建某个定义下的全部变量（变量表 TSV 应用） */
    rebuildVariablesForDefinition(defId, rows) {
      const w = this.activeWorkspace
      if (!w) return
      const def = w.definitions.find((d) => d.id === defId)
      if (!def) return
      // 移除该定义原有的变量
      const kept = w.variables.filter((v) => !(v.defId === def.id || v.structId === def.structId))
      const rebuilt = rows.map((r, ri) => ({
        id: nextId(),
        name: r.name || `${def.name} 变量 ${ri + 1}`,
        structId: def.structId,
        defId: def.id,
        fields: def.fields.map((f, i) => ({
          key: f.key,
          paramType: f.paramType,
          value: r.values[i]
        }))
      }))
      w.variables = [...kept, ...rebuilt]
      this.persist()
    },

    /** 导入结构体变量 JSON（必须已导入同 structId 的结构体定义） */
    importVariable(text) {
      const w = this.activeWorkspace
      if (!w) throw new Error('请先选择或新建一个工作区')
      const obj = fromJSON(text)
      if (!obj || obj.type !== 'Struct' || !Array.isArray(obj.value)) {
        throw new Error('不是合法的“结构体变量”JSON')
      }
      const matchedDef = w.definitions.find((d) => d.structId === obj.structId)
      if (!matchedDef) {
        throw new Error(
          `当前存档未找到 structId=${obj.structId} 的结构体定义，请先在“高级数据管理”导入对应结构体`
        )
      }
      const parsed = parseStructVariable(obj, matchedDef.fields)
      const variable = {
        id: nextId(),
        name: `${matchedDef.name} 变量 ${w.variables.length + 1}`,
        structId: obj.structId,
        defId: matchedDef.id,
        fields: parsed.fields
      }
      w.variables.push(variable)
      this.selectVariable(variable.id)
      this.message = `已导入结构体变量：structId=${variable.structId}`
      this.persist()
    },

    exportVariable(id) {
      const v = this.variables.find((x) => x.id === id) ?? this.activeVariable
      if (!v) return null
      return buildStructVariable({ fields: v.fields }, v.structId)
    },

    // ---------- 普通 JSON 编辑后原地回写（反向转换） ----------
    /** 用编辑后的“结构体定义 JSON”原地更新指定定义 */
    applyJsonToDefinition(id, text) {
      const def = this.definitions.find((d) => d.id === id)
      if (!def) throw new Error('未找到要更新的结构体定义')
      const parsed = parseStructDefinition(fromJSON(text))
      def.name = parsed.name
      def.structType = parsed.structType
      def.fields = parsed.fields
      // 同步所有绑定该定义的变量的字段名/类型
      this.variables
        .filter((v) => v.defId === def.id || v.structId === def.structId)
        .forEach((v) => this.syncVariableKeys(v))
      this.message = '已应用 JSON 到结构体定义'
      this.persist()
    },

    /** 用编辑后的“结构体变量 JSON”原地更新指定变量 */
    applyJsonToVariable(id, text) {
      const w = this.activeWorkspace
      const v = this.variables.find((x) => x.id === id)
      if (!v) throw new Error('未找到要更新的结构体变量')
      const obj = fromJSON(text)
      if (!obj || obj.type !== 'Struct' || !Array.isArray(obj.value)) {
        throw new Error('不是合法的“结构体变量”JSON')
      }
      const matchedDef = w?.definitions.find((d) => d.structId === obj.structId)
      if (!matchedDef) {
        throw new Error(
          `当前存档未找到 structId=${obj.structId} 的结构体定义，无法绑定该变量`
        )
      }
      const parsed = parseStructVariable(obj, matchedDef.fields)
      v.structId = obj.structId
      v.defId = matchedDef.id
      v.fields = parsed.fields
      this.message = '已应用 JSON 到结构体变量'
      this.persist()
    },

    // ---------- 字段编辑（作用于当前编辑对象） ----------
    addField() {
      const t = this.editingTarget
      if (!t) return
      t.fields.push({
        key: `字段_${t.fields.length + 1}`,
        paramType: 'Int32',
        value: defaultValueForType('Int32')
      })
      this.persist()
    },

    removeField(index) {
      const t = this.editingTarget
      if (!t) return
      t.fields.splice(index, 1)
      this.persist()
    },

    moveField(index, delta) {
      const t = this.editingTarget
      if (!t) return
      const target = index + delta
      if (target < 0 || target >= t.fields.length) return
      const [item] = t.fields.splice(index, 1)
      t.fields.splice(target, 0, item)
      this.persist()
    },

    changeFieldType(index, paramType) {
      const t = this.editingTarget
      if (!t) return
      const field = t.fields[index]
      field.paramType = paramType
      field.value = defaultValueForType(paramType)
      this.persist()
    },

    touch() {
      this.persist()
    },

    // ---------- 示例 ----------
    loadSample(key) {
      const sample = SAMPLES.find((s) => s.key === key)
      const w = this.activeWorkspace
      if (!sample || !w) return
      const parsed = parseStructDefinition(sample.data)
      const def = {
        id: nextId(),
        structId: genStructId(),
        name: parsed.name,
        structType: parsed.structType,
        fields: parsed.fields
      }
      w.definitions.push(def)
      this.selectDefinition(def.id)
      this.message = `已加载示例：${sample.label}`
      this.persist()
    }
  }
})
