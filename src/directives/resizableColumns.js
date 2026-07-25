const STATE = Symbol('resizable-columns')
const MIN_COLUMN_WIDTH = 56
const COLUMN_WIDTH_STORAGE_KEY = 'miliastra-structure-editor:column-widths:v1'
const MAX_SAVED_LAYOUTS = 120

function headerLayout(table) {
  const rows = Array.from(table.tHead?.rows ?? [])
  const occupied = []
  const leaves = []
  let columnCount = 0

  rows.forEach((row, rowIndex) => {
    occupied[rowIndex] ??= []
    let columnIndex = 0

    Array.from(row.cells).forEach((cell) => {
      while (occupied[rowIndex][columnIndex]) columnIndex++

      const start = columnIndex
      const colSpan = Math.max(1, cell.colSpan || 1)
      const rowSpan = Math.max(1, cell.rowSpan || 1)

      for (let y = rowIndex; y < rowIndex + rowSpan; y++) {
        occupied[y] ??= []
        for (let x = start; x < start + colSpan; x++) occupied[y][x] = true
      }

      const excluded = cell.matches('.mode-header-cell, .group-th, .struct-banner')
      const reachesLeafRow = rowIndex + rowSpan >= rows.length
      if (colSpan === 1 && reachesLeafRow && !excluded) {
        leaves.push({ cell, columnIndex: start })
      }

      columnIndex += colSpan
      columnCount = Math.max(columnCount, columnIndex)
    })
  })

  return { leaves, columnCount }
}

function removeHandles(state) {
  state.cleanups.splice(0).forEach((cleanup) => cleanup())
}

function layoutSignature(table) {
  return Array.from(table.tHead?.rows ?? [])
    .map((row) => Array.from(row.cells).map((cell) =>
      `${cell.colSpan}:${cell.rowSpan}:${cell.className}:${cell.textContent?.trim() ?? ''}`
    ).join('|'))
    .join('||')
}

function cancelActiveDrag(state) {
  state.dragController?.abort()
  state.dragController = null
  state.activeHandle?.classList.remove('active')
  state.activeHandle = null
  document.body.classList.remove('is-column-resizing')
}

function storageSignature(table) {
  const tableType = table.classList.contains('field-table') ? 'field' : 'grid'
  const header = Array.from(table.tHead?.rows ?? []).map((row) =>
    Array.from(row.cells)
      .filter((cell) => !cell.matches('.mode-header-cell'))
      .map((cell) => {
        const classes = Array.from(cell.classList)
          .filter((className) => className !== 'resizable-column-header')
          .sort()
          .join('.')
        const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
        return `${cell.colSpan}:${cell.rowSpan}:${classes}:${text}`
      })
      .join('|')
  ).join('||')
  return `${tableType}:${header}`
}

function readWidthStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function loadColumnWidths(signature, columnCount) {
  const widths = readWidthStore()[signature]
  if (!Array.isArray(widths) || widths.length !== columnCount) return null
  const normalized = widths.map(Number)
  if (normalized.some((width) => !Number.isFinite(width) || width < MIN_COLUMN_WIDTH)) return null
  return normalized
}

function saveColumnWidths(signature, widths) {
  if (!signature || !widths.length) return
  try {
    const store = readWidthStore()
    delete store[signature]
    store[signature] = widths.map((width) => Math.round(width * 10) / 10)
    const keys = Object.keys(store)
    keys.slice(0, Math.max(0, keys.length - MAX_SAVED_LAYOUTS)).forEach((key) => delete store[key])
    localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 浏览器禁用存储或配额不足时仍保留当前会话内的拖拽行为。
  }
}

function measuredColumnWidths(colgroup) {
  return Array.from(colgroup.children).map((col) => {
    const measured = col.getBoundingClientRect().width
    const styled = Number.parseFloat(col.style.width)
    return Math.max(MIN_COLUMN_WIDTH, measured || styled || MIN_COLUMN_WIDTH)
  })
}

function persistCurrentWidths(state) {
  if (!state.dirty || !state.colgroup) return
  saveColumnWidths(state.storageKey, measuredColumnWidths(state.colgroup))
  state.dirty = false
}

function ensureColgroup(table, leaves, columnCount, storedWidths) {
  let colgroup = table.querySelector(':scope > colgroup[data-resizable-columns]')
  if (colgroup && colgroup.children.length !== columnCount) {
    colgroup.remove()
    colgroup = null
  }

  if (!colgroup) {
    const tableWidth = table.getBoundingClientRect().width
    const fallbackWidth = Math.max(MIN_COLUMN_WIDTH, tableWidth / Math.max(1, columnCount))
    const widths = storedWidths ? [...storedWidths] : Array(columnCount).fill(fallbackWidth)
    if (!storedWidths) {
      leaves.forEach(({ cell, columnIndex }) => {
        widths[columnIndex] = Math.max(MIN_COLUMN_WIDTH, cell.getBoundingClientRect().width)
      })
    }

    colgroup = document.createElement('colgroup')
    colgroup.dataset.resizableColumns = ''
    widths.forEach((width) => {
      const col = document.createElement('col')
      col.style.width = `${width}px`
      colgroup.appendChild(col)
    })
    table.insertBefore(colgroup, table.firstChild)
    table.style.width = `${widths.reduce((sum, width) => sum + width, 0)}px`
    table.style.minWidth = '100%'
    table.style.tableLayout = 'fixed'
  }

  return colgroup
}

function setup(table, state) {
  removeHandles(state)
  const { leaves, columnCount } = headerLayout(table)
  if (!columnCount || !leaves.length) return

  state.storageKey = storageSignature(table)
  const storedWidths = loadColumnWidths(state.storageKey, columnCount)
  const colgroup = ensureColgroup(table, leaves, columnCount, storedWidths)
  state.colgroup = colgroup

  leaves.forEach(({ cell, columnIndex }) => {
    const col = colgroup.children[columnIndex]
    if (!col) return

    cell.classList.add('resizable-column-header')
    const handle = document.createElement('span')
    handle.className = 'column-resize-handle'
    handle.title = '拖动调整列宽'
    handle.setAttribute('aria-hidden', 'true')
    cell.appendChild(handle)

    const onPointerDown = (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      const startX = event.clientX
      const startWidth = Math.max(MIN_COLUMN_WIDTH, cell.getBoundingClientRect().width)
      const startTableWidth = table.getBoundingClientRect().width
      cancelActiveDrag(state)
      const controller = new AbortController()
      state.dragController = controller
      state.activeHandle = handle
      document.body.classList.add('is-column-resizing')
      handle.classList.add('active')

      const onPointerMove = (moveEvent) => {
        const width = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)
        col.style.width = `${width}px`
        table.style.width = `${Math.max(MIN_COLUMN_WIDTH, startTableWidth + width - startWidth)}px`
        state.dirty = true
      }

      const onPointerEnd = () => {
        persistCurrentWidths(state)
        document.body.classList.remove('is-column-resizing')
        handle.classList.remove('active')
        controller.abort()
        if (state.dragController === controller) state.dragController = null
        if (state.activeHandle === handle) state.activeHandle = null
      }

      window.addEventListener('pointermove', onPointerMove, { signal: controller.signal })
      window.addEventListener('pointerup', onPointerEnd, { signal: controller.signal, once: true })
      window.addEventListener('pointercancel', onPointerEnd, { signal: controller.signal, once: true })
      window.addEventListener('blur', onPointerEnd, { signal: controller.signal, once: true })
    }

    handle.addEventListener('pointerdown', onPointerDown)
    state.cleanups.push(() => {
      handle.removeEventListener('pointerdown', onPointerDown)
      handle.remove()
      cell.classList.remove('resizable-column-header')
    })
  })
}

function schedule(table) {
  const state = table[STATE]
  cancelAnimationFrame(state.frame)
  state.frame = requestAnimationFrame(() => {
    const signature = layoutSignature(table)
    if (signature === state.signature) return
    state.signature = signature
    setup(table, state)
  })
}

export const resizableColumns = {
  mounted(table) {
    table[STATE] = {
      frame: 0,
      cleanups: [],
      signature: '',
      storageKey: '',
      colgroup: null,
      dirty: false,
      dragController: null,
      activeHandle: null
    }
    schedule(table)
  },
  updated(table) {
    schedule(table)
  },
  beforeUnmount(table) {
    const state = table[STATE]
    if (!state) return
    cancelAnimationFrame(state.frame)
    persistCurrentWidths(state)
    cancelActiveDrag(state)
    removeHandles(state)
    delete table[STATE]
  }
}