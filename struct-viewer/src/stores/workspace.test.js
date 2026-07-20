import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore } from './workspace.js'

const STORAGE_KEY = 'miliastra-structure-editor'
const LEGACY_STORAGE_KEY = 'miliastra-struct-viewer'

function createMemoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear()
  }
}

function createStore() {
  setActivePinia(createPinia())
  const store = useWorkspaceStore()
  store.init()
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', createMemoryStorage())
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('workspace store integrity', () => {
  it('ignores malformed persisted data and keeps a recovery copy', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workspaces: {} }))
    const store = createStore()

    expect(store.workspaces).toHaveLength(1)
    expect(store.message).toContain('recovery')
    expect(localStorage.getItem(`${STORAGE_KEY}-recovery`)).not.toBeNull()
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('recovers the next internal id when persisted uid is missing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      workspaces: [{ id: 40, name: '旧存档', definitions: [], variables: [] }]
    }))
    const store = createStore()
    store.addWorkspace()

    expect(store.activeWorkspaceId).toBeGreaterThan(40)
  })

  it('migrates the legacy project cache key without losing workspace data', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      workspaces: [{ id: 12, name: '旧项目存档', definitions: [], variables: [] }],
      uid: 13
    }))

    const store = createStore()

    expect(store.workspaces[0].name).toBe('旧项目存档')
    expect(store.message).toContain('迁移')
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('requires a unique non-empty struct id before creating variables', () => {
    const store = createStore()
    store.addDefinition()
    const first = store.activeDefinition

    store.addVariable(first.id)
    expect(store.variables).toHaveLength(0)
    expect(store.message).toContain('填写结构体索引')

    expect(store.setDefinitionStructId(first.id, '100')).toBe(true)
    store.addVariable(first.id)
    expect(store.variables).toHaveLength(1)

    store.addDefinition()
    expect(store.setDefinitionStructId(store.activeDefinition.id, '100')).toBe(false)
    expect(store.message).toContain('已被')
  })

  it('migrates bound variables when schema fields change', () => {
    const store = createStore()
    store.addDefinition()
    const definition = store.activeDefinition
    store.setDefinitionStructId(definition.id, '200')
    store.addField()
    store.addVariable(definition.id)
    const variable = store.activeVariable

    store.renameField(0, '等级')
    expect(variable.fields[0].key).toBe('等级')

    store.changeFieldType(0, 'String')
    expect(variable.fields[0]).toMatchObject({ key: '等级', paramType: 'String', value: '' })

    store.addField()
    expect(variable.fields).toHaveLength(2)
    store.moveField(0, 1)
    expect(variable.fields.map((field) => field.key)).toEqual(definition.fields.map((field) => field.key))

    store.removeField(0)
    expect(variable.fields).toHaveLength(1)

    store.setDefinitionStructId(definition.id, '201')
    expect(variable.structId).toBe('201')
  })

  it('prevents deleting a definition that still owns variables', () => {
    const store = createStore()
    store.addDefinition()
    const definition = store.activeDefinition
    store.setDefinitionStructId(definition.id, '300')
    store.addVariable(definition.id)

    store.removeDefinition(definition.id)
    expect(store.definitions).toHaveLength(1)
    expect(store.message).toContain('仍有 1 个变量')
  })
})