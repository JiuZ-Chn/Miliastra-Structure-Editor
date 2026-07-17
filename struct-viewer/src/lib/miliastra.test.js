import { describe, it, expect } from 'vitest'
import simpleDef from '../samples/simple-struct.json'
import complexDef from '../samples/complex-struct.json'
import complexVar from '../samples/complex-variable.json'
import {
  parseStructDefinition,
  buildStructDefinition,
  definitionToVariable,
  parseStructVariable,
  buildStructVariable,
  detectKind,
  PARAM_TYPES,
  defaultValueForType,
  isListType
} from './miliastra.js'

describe('简单结构体 - 基础转换', () => {
  it('解析出 3 个字段', () => {
    const model = parseStructDefinition(simpleDef)
    expect(model.name).toBe('简单结构体')
    expect(model.fields).toHaveLength(3)
    expect(model.fields[0]).toMatchObject({ key: '整数变量', paramType: 'Int32', value: '0' })
    expect(model.fields[1]).toMatchObject({ key: '浮点数变量', paramType: 'Float', value: '0.00' })
    expect(model.fields[2]).toMatchObject({ key: '布尔值变量', paramType: 'Bool', value: 'False' })
  })

  it('定义 round-trip 保持不变', () => {
    const rebuilt = buildStructDefinition(parseStructDefinition(simpleDef))
    expect(rebuilt).toEqual(simpleDef)
  })
})

describe('复杂结构体 - 全类型交叉验证', () => {
  it('解析出全部 26 个字段（覆盖所有类型）', () => {
    const model = parseStructDefinition(complexDef)
    expect(model.fields).toHaveLength(26)
    const types = model.fields.map((f) => f.paramType)
    for (const t of PARAM_TYPES) {
      expect(types).toContain(t)
    }
  })

  it('复杂结构体 → 结构体变量 与真实样例完全一致', () => {
    const produced = definitionToVariable(complexDef, complexVar.structId)
    expect(produced).toEqual(complexVar)
  })

  it('复杂结构体定义 round-trip 保持不变', () => {
    const rebuilt = buildStructDefinition(parseStructDefinition(complexDef))
    expect(rebuilt).toEqual(complexDef)
  })

  it('嵌套 Struct / StructList / Dict 作为对象被正确保留', () => {
    const model = parseStructDefinition(complexDef)
    const structField = model.fields.find((f) => f.paramType === 'Struct')
    const structListField = model.fields.find((f) => f.paramType === 'StructList')
    const dictFields = model.fields.filter((f) => f.paramType === 'Dict')

    expect(structField.value).toMatchObject({ structId: '1077936130', type: 'Struct' })
    expect(Array.isArray(structField.value.value)).toBe(true)
    // StructList 内含一个嵌套 Struct 项
    expect(structListField.value).toMatchObject({ structId: '1077936130' })
    expect(structListField.value.value[0]).toMatchObject({ param_type: 'Struct' })
    // 4 种 Dict 变体（含 value_structId）
    expect(dictFields).toHaveLength(4)
    expect(dictFields[2].value).toMatchObject({ value_type: 'Struct', value_structId: '1077936130' })
  })
})

describe('反向转换 - 结构体变量', () => {
  it('复杂结构体变量可无损转回千星结构', () => {
    const template = parseStructDefinition(complexDef).fields
    const parsed = parseStructVariable(complexVar, template)
    const rebuilt = buildStructVariable({ fields: parsed.fields }, complexVar.structId)
    expect(rebuilt).toEqual(complexVar)
  })

  it('修改某个变量值后能正确回写', () => {
    const template = parseStructDefinition(complexDef).fields
    const edited = structuredClone(complexVar)
    edited.value[2].value = '42' // Int32 字段
    const parsed = parseStructVariable(edited, template)
    const rebuilt = buildStructVariable({ fields: parsed.fields }, edited.structId)
    expect(rebuilt.value[2]).toEqual({ param_type: 'Int32', value: '42' })
    expect(rebuilt.value[0]).toEqual(complexVar.value[0])
  })

  it('detectKind 能区分定义与变量', () => {
    expect(detectKind(complexDef)).toBe('definition')
    expect(detectKind(complexVar)).toBe('variable')
    expect(detectKind(simpleDef)).toBe('definition')
  })
})

describe('千星完整类型体系', () => {
  it('覆盖全部 23 种参数类型', () => {
    expect(PARAM_TYPES).toHaveLength(23)
  })

  it('各类型默认值符合千星格式', () => {
    expect(defaultValueForType('Int32')).toBe('0')
    expect(defaultValueForType('Float')).toBe('0.00')
    expect(defaultValueForType('Bool')).toBe('False')
    expect(defaultValueForType('Vector3')).toBe('0,0,0')
    expect(defaultValueForType('Int32List')).toEqual([])
    expect(defaultValueForType('Struct')).toMatchObject({ type: 'Struct', value: [] })
    expect(defaultValueForType('StructList')).toMatchObject({ value: [] })
    expect(defaultValueForType('Dict')).toMatchObject({ type: 'Dict', value: [] })
  })

  it('列表类型判定正确（StructList 不是纯数组列表）', () => {
    expect(isListType('Vector3List')).toBe(true)
    expect(isListType('ArmyList')).toBe(true)
    expect(isListType('StructList')).toBe(false)
    expect(isListType('Struct')).toBe(false)
    expect(isListType('Dict')).toBe(false)
  })
})
