import { isComplexType, isListType, validateParamValue } from './miliastra.js'

function quoteCell(value) {
  const text = String(value ?? '')
  return /[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function stringifyTsv(rows) {
  return rows.map((row) => row.map(quoteCell).join('\t')).join('\n')
}

export function parseTsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === '\t') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (quoted) throw new Error('TSV 存在未闭合的引号')
  if (field !== '' || row.length || !rows.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function encodeTabularValue(paramType, value) {
  if (isListType(paramType) || isComplexType(paramType)) {
    return JSON.stringify(value ?? (isListType(paramType) ? [] : null))
  }
  return String(value ?? '')
}

export function decodeTabularValue(paramType, text) {
  let value
  if (isListType(paramType)) {
    const source = text.trim()
    if (source === '') value = []
    else if (source.startsWith('[')) value = JSON.parse(source)
    else value = source.split('|').map((item) => item.trim())
  } else if (isComplexType(paramType)) {
    value = JSON.parse(text)
  } else {
    value = paramType === 'String' ? text : text.trim()
  }
  validateParamValue(paramType, value, 'TSV 单元格')
  return value
}

export function assertHeader(actual, expected) {
  if (actual.length !== expected.length || actual.some((cell, index) => cell !== expected[index])) {
    throw new Error(`TSV 表头不匹配：期望 ${expected.join(' / ')}`)
  }
}