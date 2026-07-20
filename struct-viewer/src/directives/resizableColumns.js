const STATE = Symbol('resizable-columns')
const MIN_COLUMN_WIDTH = 56

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
  document.body.classList.remove('is-column-resizing')
}

function ensureColgroup(table, leaves, columnCount) {
  let colgroup = table.querySelector(':scope > colgroup[data-resizable-columns]')
  if (colgroup && colgroup.children.length !== columnCount) {
    colgroup.remove()
    colgroup = null
  }

  if (!colgroup) {
    const tableWidth = table.getBoundingClientRect().width
    const fallbackWidth = Math.max(MIN_COLUMN_WIDTH, tableWidth / Math.max(1, columnCount))
    const widths = Array(columnCount).fill(fallbackWidth)
    leaves.forEach(({ cell, columnIndex }) => {
      widths[columnIndex] = Math.max(MIN_COLUMN_WIDTH, cell.getBoundingClientRect().width)
    })

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

  const colgroup = ensureColgroup(table, leaves, columnCount)

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
      document.body.classList.add('is-column-resizing')
      handle.classList.add('active')

      const onPointerMove = (moveEvent) => {
        const width = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)
        col.style.width = `${width}px`
        table.style.width = `${Math.max(MIN_COLUMN_WIDTH, startTableWidth + width - startWidth)}px`
      }

      const onPointerEnd = () => {
        document.body.classList.remove('is-column-resizing')
        handle.classList.remove('active')
        controller.abort()
        if (state.dragController === controller) state.dragController = null
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
    table[STATE] = { frame: 0, cleanups: [], signature: '', dragController: null }
    schedule(table)
  },
  updated(table) {
    schedule(table)
  },
  beforeUnmount(table) {
    const state = table[STATE]
    if (!state) return
    cancelAnimationFrame(state.frame)
    cancelActiveDrag(state)
    removeHandles(state)
    delete table[STATE]
  }
}