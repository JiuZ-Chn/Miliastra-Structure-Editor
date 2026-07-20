import { describe, expect, it } from 'vitest'
import {
  createBlankStructValue,
  flattenStructDefinition,
  getStructEntryAtPath,
  groupFlattenedColumns,
  setStructValueAtPath
} from './flatten.js'

const currency = {
  structId: '2',
  fields: [
    { key: '金币', paramType: 'Int32', value: '0' },
    { key: '水晶', paramType: 'Int32', value: '0' }
  ]
}
const level = {
  structId: '1',
  fields: [
    { key: '说明', paramType: 'String', value: '' },
    {
      key: '需求货币',
      paramType: 'Struct',
      value: { structId: '2', type: 'Struct', value: [] }
    },
    { key: '数值', paramType: 'Int32List', value: [] }
  ]
}
const definitions = new Map([['1', level], ['2', currency]])
const resolveDefinition = (id) => definitions.get(String(id)) ?? null

describe('Struct flatten adapter', () => {
  it('flattens nested fixed Struct fields into grouped leaf columns', () => {
    const columns = flattenStructDefinition(level, resolveDefinition)
    expect(columns.map((column) => column.label)).toEqual([
      '说明',
      '需求货币.金币',
      '需求货币.水晶',
      '数值'
    ])
    expect(columns[1]).toMatchObject({
      group: '需求货币',
      leaf: '金币',
      path: [1, 0],
      paramType: 'Int32'
    })
    expect(groupFlattenedColumns(columns).map((group) => [group.group, group.columns.length]))
      .toEqual([['', 1], ['需求货币', 2], ['', 1]])
  })

  it('creates recursive defaults and reads/writes by positional path', () => {
    const value = createBlankStructValue(level, resolveDefinition)
    expect(value.value[1].value).toMatchObject({ structId: '2', type: 'Struct' })
    expect(getStructEntryAtPath(value, [1, 0])?.value).toBe('0')
    expect(setStructValueAtPath(value, [1, 0], '99')).toBe(true)
    expect(getStructEntryAtPath(value, [1, 0])?.value).toBe('99')
    expect(value.value[2].value).toEqual([])
  })

  it('stops at circular references instead of recursing forever', () => {
    const recursive = {
      structId: '3',
      fields: [{
        key: '子节点',
        paramType: 'Struct',
        value: { structId: '3', type: 'Struct', value: [] }
      }]
    }
    const columns = flattenStructDefinition(recursive, (id) => id === '3' ? recursive : null)
    expect(columns).toHaveLength(1)
    expect(columns[0]).toMatchObject({ label: '子节点', paramType: 'Struct' })
  })
})