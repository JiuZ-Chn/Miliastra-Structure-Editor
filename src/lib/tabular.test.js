import { describe, expect, it } from 'vitest'
import {
  assertHeader,
  decodeTabularValue,
  encodeTabularValue,
  parseTsv,
  stringifyTsv
} from './tabular.js'

describe('TSV codec', () => {
  it('round-trips tabs, newlines and quotes', () => {
    const rows = [['名称', '说明'], ['A\tB', '第一行\n第二行 "引用"']]
    expect(parseTsv(stringifyTsv(rows))).toEqual(rows)
  })

  it('round-trips string lists containing separators', () => {
    const value = ['A|B', '含\tTab', '含\n换行']
    const encoded = encodeTabularValue('StringList', value)
    expect(decodeTabularValue('StringList', encoded)).toEqual(value)
  })

  it('keeps compatibility with legacy pipe-separated lists', () => {
    expect(decodeTabularValue('Int32List', '1 | 2 | 3')).toEqual(['1', '2', '3'])
  })

  it('rejects malformed complex values and mismatched headers', () => {
    expect(() => decodeTabularValue('StructList', '[]')).toThrow('StructList 值格式无效')
    expect(() => assertHeader(['A'], ['B'])).toThrow('表头不匹配')
  })
})