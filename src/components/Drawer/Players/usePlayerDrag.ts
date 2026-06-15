import { type InjectionKey, type Ref, ref } from 'vue'

export interface PlayerDragApi {
  draggingName: Ref<string | null>
  overIndex: Ref<number | null>
  startDrag: (e: PointerEvent, playerName: string) => void
}

export const playerDragKey: InjectionKey<PlayerDragApi> = Symbol('playerDrag')

const LONG_PRESS_MS = 220
const MOVE_THRESHOLD = 8

export function createPlayerDrag(
  onDrop: (playerName: string, targetIndex: number) => void,
): PlayerDragApi {
  const draggingName = ref<string | null>(null)
  const overIndex = ref<number | null>(null)

  let ghost: HTMLElement | null = null
  let sourceEl: HTMLElement | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let pointerId = -1
  let started = false
  let pendingName = ''
  const startPos = { x: 0, y: 0 }

  const findSlotUnder = (x: number, y: number): { index: number, occupied: boolean } | null => {
    const slotEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-index]')
    if (!slotEl) return null
    return {
      index: Number(slotEl.dataset.slotIndex),
      occupied: slotEl.dataset.slotOccupied === 'true',
    }
  }

  const createGhost = (x: number, y: number) => {
    if (!sourceEl) return
    const rect = sourceEl.getBoundingClientRect()
    const clone = sourceEl.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.left = '0'
    clone.style.top = '0'
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.boxSizing = 'border-box'
    clone.style.margin = '0'
    clone.style.pointerEvents = 'none'
    clone.style.opacity = '0.9'
    clone.style.zIndex = '9999'
    document.body.appendChild(clone)
    ghost = clone
    moveGhost(x, y)
  }

  const moveGhost = (x: number, y: number) => {
    if (!ghost) return
    ghost.style.transform = `translate(${x - ghost.offsetWidth / 2}px, ${y - ghost.offsetHeight / 2}px)`
  }

  const beginDrag = (x: number, y: number) => {
    started = true
    draggingName.value = pendingName
    createGhost(x, y)
    if (sourceEl) sourceEl.style.opacity = '0.4'
    document.body.style.userSelect = 'none'
    navigator.vibrate?.(10)
  }

  const cleanup = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    ghost?.remove()
    ghost = null
    if (sourceEl) sourceEl.style.opacity = ''
    sourceEl = null
    started = false
    pointerId = -1
    draggingName.value = null
    overIndex.value = null
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    document.removeEventListener('touchmove', onTouchMove)
  }

  const onTouchMove = (e: TouchEvent) => {
    if (started) e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y)

    if (!started) {
      if (e.pointerType === 'mouse') {
        if (dist <= MOVE_THRESHOLD) return
        beginDrag(e.clientX, e.clientY)
      }
      else {
        if (dist > MOVE_THRESHOLD) cleanup()
        return
      }
    }

    e.preventDefault()
    moveGhost(e.clientX, e.clientY)
    const target = findSlotUnder(e.clientX, e.clientY)
    overIndex.value = target && !target.occupied ? target.index : null
  }

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    const wasStarted = started
    const dropIndex = overIndex.value
    const name = pendingName

    cleanup()

    if (wasStarted && dropIndex !== null) {
      onDrop(name, dropIndex)
    }
  }

  const startDrag = (e: PointerEvent, playerName: string) => {
    if (pointerId !== -1) return
    pointerId = e.pointerId
    pendingName = playerName
    sourceEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-slot-index]')
    startPos.x = e.clientX
    startPos.y = e.clientY
    started = false

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    if (e.pointerType !== 'mouse') {
      longPressTimer = setTimeout(() => {
        longPressTimer = null
        beginDrag(startPos.x, startPos.y)
      }, LONG_PRESS_MS)
    }
  }

  return { draggingName, overIndex, startDrag }
}
